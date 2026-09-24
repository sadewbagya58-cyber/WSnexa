package com.wsnexa.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.WebViewListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.util.Base64;

public class MainActivity extends BridgeActivity {
    private static final int LOCATION_PERMISSION_REQ_CODE = 2001;

    private int safeAreaTopDp = 34; // Sensible default for modern punch-hole Android phones
    private int safeAreaBottomDp = 0;
    private String pendingGeoOrigin = null;
    private GeolocationPermissions.Callback pendingGeoCallback = null;
    private boolean hasRedirectedToDashboard = false;

    private void checkAuthenticatedStartup(WebView webView) {
        if (webView == null || hasRedirectedToDashboard) return;
        try {
            boolean wasAuth = getSharedPreferences("wsnexa_app_prefs", Context.MODE_PRIVATE)
                .getBoolean("is_authenticated", false);
            CookieManager cm = CookieManager.getInstance();
            String cookies = cm.getCookie("https://w-snexa.vercel.app");
            boolean hasAuthCookie = (cookies != null && (cookies.contains("auth-token") || cookies.contains("sb-")));

            if (wasAuth || hasAuthCookie) {
                String curUrl = webView.getUrl();
                if (curUrl == null || curUrl.equals("about:blank") || curUrl.equals("https://w-snexa.vercel.app") || curUrl.equals("https://w-snexa.vercel.app/")) {
                    hasRedirectedToDashboard = true;
                    webView.stopLoading();
                    webView.loadUrl("https://w-snexa.vercel.app/dashboard");
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Initialize hardware status bar height from system resources
        this.safeAreaTopDp = getStatusBarHeightDp();

        // Configure WebViewListener on bridgeBuilder before super.onCreate
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                checkAuthenticatedStartup(webView);
                injectSafeArea(webView);
                injectBridges(webView);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                injectSafeArea(webView);
                injectBridges(webView);
            }

            @Override
            public void onReceivedError(WebView webView) {
                // When connectivity is lost, NEVER redirect or replace the application with offline.html.
                // The existing WSNexa Web App shell remains mounted and active.
                // Offline status is seamlessly surfaced via the in-app OfflineBanner and offline sync engine.
            }
        });

        super.onCreate(savedInstanceState);

        // Enable modern Android edge-to-edge rendering without letterboxing
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Set light status bar icons (dark glyphs) so clock/battery are visible over white header
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }

        // Capture safe-area insets (status bar + display cutout) and calculate density-independent dp
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, insets) -> {
            Insets statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout());
            Insets navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());

            float density = getResources().getDisplayMetrics().density;
            int topFromInsets = Math.round(statusBarInsets.top / density);
            this.safeAreaTopDp = Math.max(topFromInsets, getStatusBarHeightDp());
            this.safeAreaBottomDp = Math.max(0, Math.round(navBarInsets.bottom / density));

            injectSafeArea(this.bridge != null ? this.bridge.getWebView() : null);
            return insets;
        });

        // Initialize bridges, caching, and custom WebChromeClient on the WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);

            webView.addJavascriptInterface(new AndroidAuthBridge(), "AndroidAuthBridge");
            webView.addJavascriptInterface(new AndroidDownloadBridge(), "AndroidDownloadBridge");
            webView.addJavascriptInterface(new AndroidPrintBridge(), "AndroidPrintBridge");
            webView.addJavascriptInterface(new AndroidLocationBridge(), "AndroidLocationBridge");
            webView.setWebChromeClient(new CustomWebChromeClient(this.bridge));
            this.bridge.setWebViewClient(new CustomWebViewClient(this.bridge));

            checkAuthenticatedStartup(webView);
        }
    }

    private int getStatusBarHeightDp() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            int px = getResources().getDimensionPixelSize(resourceId);
            float density = getResources().getDisplayMetrics().density;
            result = Math.round(px / density);
        }
        return Math.max(result, 28);
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network network = cm.getActiveNetwork();
                if (network == null) return false;
                NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
                return capabilities != null && (
                    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                );
            } else {
                NetworkInfo info = cm.getActiveNetworkInfo();
                return info != null && info.isConnected();
            }
        } catch (Exception e) {
            return true;
        }
    }

    private void injectSafeArea(WebView webView) {
        if (webView == null) return;
        int topDp = Math.max(safeAreaTopDp, getStatusBarHeightDp());
        int bottomDp = safeAreaBottomDp;
        webView.post(() -> {
            String js = String.format(
                "(function() {" +
                "  var sat = '%dpx';" +
                "  var sab = '%dpx';" +
                "  document.documentElement.style.setProperty('--sat', sat);" +
                "  document.documentElement.style.setProperty('--sab', sab);" +
                "  var styleEl = document.getElementById('wsnexa-safe-area-style');" +
                "  if (!styleEl) {" +
                "    styleEl = document.createElement('style');" +
                "    styleEl.id = 'wsnexa-safe-area-style';" +
                "    document.head.appendChild(styleEl);" +
                "  }" +
                "  styleEl.textContent = ':root { --sat: ' + sat + ' !important; --sab: ' + sab + ' !important; }';" +
                "})();",
                topDp, bottomDp
            );
            webView.evaluateJavascript(js, null);
        });
    }

    private void injectBridges(WebView webView) {
        if (webView == null) return;
        webView.post(() -> {
            String js =
                "(function() {" +
                "  if (window.AndroidPrintBridge && !window.__wsnexa_print_bridged) {" +
                "    window.__wsnexa_print_bridged = true;" +
                "    window.print = function() { window.AndroidPrintBridge.print(); };" +
                "  }" +
                "})();";
            webView.evaluateJavascript(js, null);
        });
    }

    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null && this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == LOCATION_PERMISSION_REQ_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
                pendingGeoCallback = null;
                pendingGeoOrigin = null;
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    // ── Custom WebChromeClient with Geolocation Bridging ─────────────────────

    private class CustomWebChromeClient extends BridgeWebChromeClient {
        public CustomWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {

                // Check if device master GPS/Location toggle is enabled
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                boolean isLocationOn = false;
                if (lm != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        isLocationOn = lm.isLocationEnabled();
                    } else {
                        isLocationOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                                       lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
                    }
                }

                if (!isLocationOn) {
                    Toast.makeText(MainActivity.this, "Please turn on device Location Services (GPS)", Toast.LENGTH_LONG).show();
                    try {
                        Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }

                callback.invoke(origin, true, false);
            } else {
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                    LOCATION_PERMISSION_REQ_CODE
                );
            }
        }
    }

    // ── JavaScript Bridge for Location Settings ──────────────────────────────

    public class AndroidLocationBridge {
        @JavascriptInterface
        public boolean isLocationEnabled() {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm == null) return false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return lm.isLocationEnabled();
                } else {
                    return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                           lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
                }
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openLocationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ex) {
                        Toast.makeText(MainActivity.this, "Please enable Location in device Settings", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }

    // ── JavaScript Bridge for Report Downloads (Scoped Storage Supported) ────

    public class AndroidDownloadBridge {
        @JavascriptInterface
        public void saveFile(String content, String mimeType, String filename) {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            OutputStream os = getContentResolver().openOutputStream(uri);
                            if (os != null) {
                                os.write(content.getBytes(StandardCharsets.UTF_8));
                                os.flush();
                                os.close();
                            }
                            Toast.makeText(MainActivity.this, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();

                            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                            viewIntent.setDataAndType(uri, mimeType);
                            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            try {
                                startActivity(Intent.createChooser(viewIntent, "Open " + filename));
                            } catch (ActivityNotFoundException e) {
                                // File saved successfully in public Downloads
                            }
                        } else {
                            throw new Exception("Could not create MediaStore entry");
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) {
                            downloadsDir.mkdirs();
                        }
                        File file = new File(downloadsDir, filename);
                        FileOutputStream fos = new FileOutputStream(file);
                        fos.write(content.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                        fos.close();

                        MediaScannerConnection.scanFile(
                            MainActivity.this,
                            new String[]{file.getAbsolutePath()},
                            new String[]{mimeType},
                            null
                        );

                        Toast.makeText(MainActivity.this, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();

                        Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(fileUri, mimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(Intent.createChooser(viewIntent, "Open " + filename));
                        } catch (ActivityNotFoundException e) {
                            // File saved successfully
                        }
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        /**
         * Saves a binary file whose content is base64-encoded.
         * Use this for XLSX, binary PDF, or any non-text format.
         * JavaScript callers: btoa(binaryString) or Buffer.from(...).toString('base64')
         */
        @JavascriptInterface
        public void saveFileBase64(String base64Content, String mimeType, String filename) {
            runOnUiThread(() -> {
                try {
                    byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            OutputStream os = getContentResolver().openOutputStream(uri);
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                                os.close();
                            }
                            Toast.makeText(MainActivity.this, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();
                            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                            viewIntent.setDataAndType(uri, mimeType);
                            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            try {
                                startActivity(Intent.createChooser(viewIntent, "Open " + filename));
                            } catch (ActivityNotFoundException e) {
                                // File saved; no app installed to open it
                            }
                        } else {
                            throw new Exception("Could not create MediaStore entry");
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) downloadsDir.mkdirs();
                        File file = new File(downloadsDir, filename);
                        FileOutputStream fos = new FileOutputStream(file);
                        fos.write(bytes);
                        fos.flush();
                        fos.close();
                        MediaScannerConnection.scanFile(MainActivity.this,
                            new String[]{file.getAbsolutePath()}, new String[]{mimeType}, null);
                        Toast.makeText(MainActivity.this, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();
                        Uri fileUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(fileUri, mimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(Intent.createChooser(viewIntent, "Open " + filename));
                        } catch (ActivityNotFoundException e) {
                            // File saved; no app installed to open it
                        }
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    // ── JavaScript Bridge for Native Receipts & Report Printing ──────────────

    public class AndroidPrintBridge {
        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null && bridge != null && bridge.getWebView() != null) {
                        PrintDocumentAdapter printAdapter = bridge.getWebView().createPrintDocumentAdapter("WSNexa Receipt");
                        printManager.print("WSNexa Receipt", printAdapter, new PrintAttributes.Builder().build());
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Print error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void printHtml(String html, String title) {
            runOnUiThread(() -> {
                try {
                    WebView printWebView = new WebView(MainActivity.this);
                    printWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                String jobName = title != null && !title.isEmpty() ? title : "WSNexa Report";
                                PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(jobName);
                                printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                            }
                        }
                    });
                    printWebView.loadDataWithBaseURL("https://w-snexa.vercel.app", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Print report error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    // ── JavaScript Bridge for Authentication State Persistence ────────────────

    public class AndroidAuthBridge {
        @JavascriptInterface
        public void setAuthenticated(boolean isAuthenticated) {
            try {
                getSharedPreferences("wsnexa_app_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean("is_authenticated", isAuthenticated)
                    .apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public boolean isAuthenticated() {
            try {
                return getSharedPreferences("wsnexa_app_prefs", Context.MODE_PRIVATE)
                    .getBoolean("is_authenticated", false);
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    // ── Custom WebViewClient with Safe Offline Fallback ──────────────────────

    private class CustomWebViewClient extends BridgeWebViewClient {
        public CustomWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                // Main frame network failure (e.g. offline on uncached/unsupported route)
                // NEVER display raw Chromium error page. Render brand-aligned connection required fallback.
                String html = getConnectionRequiredHtml();
                view.loadDataWithBaseURL("https://w-snexa.vercel.app", html, "text/html", "UTF-8", null);
                return;
            }
            super.onReceivedError(view, request, error);
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            String html = getConnectionRequiredHtml();
            view.loadDataWithBaseURL("https://w-snexa.vercel.app", html, "text/html", "UTF-8", null);
        }
    }

    private String getConnectionRequiredHtml() {
        int sat = Math.max(safeAreaTopDp, getStatusBarHeightDp());
        int sab = safeAreaBottomDp;
        return "<!DOCTYPE html>" +
            "<html lang=\"en\">" +
            "<head>" +
            "  <meta charset=\"UTF-8\" />" +
            "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover\" />" +
            "  <title>WSNexa — Connection Required</title>" +
            "  <style>" +
            "    :root { --sat: " + sat + "px; --sab: " + sab + "px; }" +
            "    * { box-sizing: border-box; margin: 0; padding: 0; }" +
            "    body {" +
            "      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;" +
            "      background-color: #ffffff;" +
            "      color: #09090b;" +
            "      min-height: 100vh;" +
            "      display: flex;" +
            "      flex-direction: column;" +
            "      padding-top: calc(max(env(safe-area-inset-top, 0px), var(--sat, 0px)) + 1rem);" +
            "      padding-bottom: calc(max(env(safe-area-inset-bottom, 0px), var(--sab, 0px)) + 1rem);" +
            "      padding-left: 1rem;" +
            "      padding-right: 1rem;" +
            "    }" +
            "    .header {" +
            "      display: flex;" +
            "      align-items: center;" +
            "      justify-content: space-between;" +
            "      max-width: 480px;" +
            "      width: 100%;" +
            "      margin: 0 auto 2rem auto;" +
            "      padding: 0 0.5rem;" +
            "    }" +
            "    .logo-text {" +
            "      font-size: 1.125rem;" +
            "      font-weight: 900;" +
            "      letter-spacing: -0.025em;" +
            "      color: #09090b;" +
            "    }" +
            "    .offline-tag {" +
            "      font-size: 0.6875rem;" +
            "      font-weight: 800;" +
            "      background-color: #fef3c7;" +
            "      color: #92400e;" +
            "      border: 1px solid #fde68a;" +
            "      padding: 0.25rem 0.625rem;" +
            "      border-radius: 9999px;" +
            "      text-transform: uppercase;" +
            "      letter-spacing: 0.05em;" +
            "    }" +
            "    .card {" +
            "      max-width: 480px;" +
            "      width: 100%;" +
            "      margin: auto auto;" +
            "      background: #ffffff;" +
            "      border: 1px solid #e4e4e7;" +
            "      border-radius: 1.25rem;" +
            "      padding: 2rem 1.5rem;" +
            "      text-align: center;" +
            "      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);" +
            "    }" +
            "    .icon {" +
            "      width: 3.5rem;" +
            "      height: 3.5rem;" +
            "      border-radius: 9999px;" +
            "      background-color: #f4f4f5;" +
            "      display: flex;" +
            "      align-items: center;" +
            "      justify-content: center;" +
            "      font-size: 1.75rem;" +
            "      margin: 0 auto 1.25rem auto;" +
            "    }" +
            "    h1 {" +
            "      font-size: 1.25rem;" +
            "      font-weight: 900;" +
            "      color: #09090b;" +
            "      margin-bottom: 0.5rem;" +
            "    }" +
            "    p {" +
            "      font-size: 0.8125rem;" +
            "      color: #71717a;" +
            "      line-height: 1.5;" +
            "      margin-bottom: 1.5rem;" +
            "    }" +
            "    .tool-group {" +
            "      display: flex;" +
            "      flex-direction: column;" +
            "      gap: 0.625rem;" +
            "      margin-bottom: 1.25rem;" +
            "    }" +
            "    .btn {" +
            "      display: flex;" +
            "      align-items: center;" +
            "      justify-content: center;" +
            "      width: 100%;" +
            "      min-height: 46px;" +
            "      padding: 0.75rem 1rem;" +
            "      border-radius: 0.75rem;" +
            "      font-size: 0.8125rem;" +
            "      font-weight: 800;" +
            "      text-decoration: none;" +
            "      transition: all 0.15s ease;" +
            "      touch-action: manipulation;" +
            "      cursor: pointer;" +
            "    }" +
            "    .btn:active { transform: scale(0.98); }" +
            "    .btn-dark {" +
            "      background-color: #09090b;" +
            "      color: #ffffff;" +
            "      border: none;" +
            "    }" +
            "    .btn-outline {" +
            "      background-color: #fafafa;" +
            "      color: #18181b;" +
            "      border: 1px solid #d4d4d8;" +
            "    }" +
            "    .btn-secondary {" +
            "      background-color: transparent;" +
            "      color: #71717a;" +
            "      border: 1px solid #e4e4e7;" +
            "      font-weight: 600;" +
            "    }" +
            "    .notice {" +
            "      display: none;" +
            "      margin-top: 0.75rem;" +
            "      padding: 0.625rem;" +
            "      background-color: #fef3c7;" +
            "      border: 1px solid #fde68a;" +
            "      border-radius: 0.75rem;" +
            "      font-size: 0.75rem;" +
            "      font-weight: 600;" +
            "      color: #92400e;" +
            "    }" +
            "  </style>" +
            "</head>" +
            "<body>" +
            "  <div class=\"header\">" +
            "    <span class=\"logo-text\">WSNexa</span>" +
            "    <span class=\"offline-tag\">Offline Mode</span>" +
            "  </div>" +
            "  <div class=\"card\">" +
            "    <div class=\"icon\">🌐</div>" +
            "    <h1>Connection Required</h1>" +
            "    <p>This section requires an active internet connection. Your offline tools (Take Order, Dining Tables, KDS) remain fully operational.</p>" +
            "    <div class=\"tool-group\">" +
            "      <a href=\"/dashboard/waiter/order\" class=\"btn btn-dark\">Take Order (Offline Ready)</a>" +
            "      <a href=\"/dashboard/tables\" class=\"btn btn-outline\">Dining Tables</a>" +
            "    </div>" +
            "    <div style=\"display: flex; gap: 0.5rem; flex-direction: column;\">" +
            "      <button type=\"button\" onclick=\"handleRetry()\" class=\"btn btn-secondary\" id=\"retry-btn\">🔄 Try Again</button>" +
            "      <a href=\"/dashboard\" class=\"btn btn-secondary\">Return to Dashboard</a>" +
            "    </div>" +
            "    <div id=\"offline-notice\" class=\"notice\">" +
            "      Device is still offline. Please connect to Wi-Fi or mobile data to access this section." +
            "    </div>" +
            "  </div>" +
            "  <script>" +
            "    function handleRetry() {" +
            "      var notice = document.getElementById('offline-notice');" +
            "      var btn = document.getElementById('retry-btn');" +
            "      if (!navigator.onLine) {" +
            "        if (notice) notice.style.display = 'block';" +
            "        return;" +
            "      }" +
            "      if (btn) btn.textContent = 'Retrying...';" +
            "      window.location.reload();" +
            "    }" +
            "    window.addEventListener('online', function() {" +
            "      window.location.reload();" +
            "    });" +
            "  </script>" +
            "</body>" +
            "</html>";
    }
}
