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
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Initialize hardware status bar height from system resources
        this.safeAreaTopDp = getStatusBarHeightDp();

        // Configure WebViewListener on bridgeBuilder before super.onCreate
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
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
                // If device has active network connectivity, NEVER redirect to offline screen.
                // Normal route changes, branch switching, and subresource aborts are ignored.
                if (isOnline()) {
                    return;
                }

                loadOfflineFallback(webView);
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

        // Initialize bridges and custom WebChromeClient on the WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new AndroidDownloadBridge(), "AndroidDownloadBridge");
            webView.addJavascriptInterface(new AndroidPrintBridge(), "AndroidPrintBridge");
            webView.addJavascriptInterface(new AndroidLocationBridge(), "AndroidLocationBridge");
            webView.setWebChromeClient(new CustomWebChromeClient(this.bridge));
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

    private void loadOfflineFallback(WebView webView) {
        if (webView == null) return;
        webView.post(() -> {
            try {
                String cur = webView.getUrl();
                if (cur != null && (cur.contains("offline") || cur.startsWith("file:///android_asset"))) {
                    return;
                }
                InputStream is = getAssets().open("public/offline.html");
                byte[] buffer = new byte[is.available()];
                is.read(buffer);
                is.close();
                String offlineHtml = new String(buffer, StandardCharsets.UTF_8);
                webView.loadDataWithBaseURL("https://w-snexa.vercel.app", offlineHtml, "text/html", "UTF-8", "https://w-snexa.vercel.app/offline");
            } catch (Exception e) {
                try {
                    webView.loadUrl("file:///android_asset/public/offline.html");
                } catch (Exception ignored) {}
            }
        });
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
}
