'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface OrgTreeNode {
  id: string;
  business_membership_id: string;
  holderName: string;
  jobTitleName: string;
  rank?: number;
  branchName?: string;
  departmentName?: string;
  isActing?: boolean;
  actingCoverName?: string;
  children?: OrgTreeNode[];
}

interface VisualOrgChartClientProps {
  tree: OrgTreeNode[];
  effectiveTree: OrgTreeNode[];
  branches: Array<{ id: string; name: string }>;
}

export function VisualOrgChartClient({
  tree,
  effectiveTree,
  branches,
}: VisualOrgChartClientProps) {
  const [viewMode, setViewMode] = useState<'substantive' | 'effective'>('substantive');
  const [layoutMode, setLayoutMode] = useState<'tree' | 'drilldown'>('tree');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [zoomScale, setZoomScale] = useState<number>(1);

  const currentTree = viewMode === 'substantive' ? tree : effectiveTree;

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleZoomIn = () => setZoomScale((s) => Math.min(Number((s + 0.15).toFixed(2)), 1.5));
  const handleZoomOut = () => setZoomScale((s) => Math.max(Number((s - 0.15).toFixed(2)), 0.5));
  const handleZoomReset = () => setZoomScale(1);

  const isMatched = (node: OrgTreeNode): boolean => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return (
      node.holderName.toLowerCase().includes(q) ||
      node.jobTitleName.toLowerCase().includes(q) ||
      Boolean(node.departmentName?.toLowerCase().includes(q))
    );
  };

  const renderNodeCard = (node: OrgTreeNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const highlighted = isMatched(node);

    return (
      <div className="flex flex-col items-center">
        {/* Node Card */}
        <div
          className={`relative w-56 sm:w-64 rounded-xl p-3.5 sm:p-4 border transition-all duration-150 shadow-xs touch-manipulation ${
            node.isActing
              ? 'bg-purple-50/40 border-purple-200 shadow-sm'
              : 'bg-white border-zinc-200 hover:border-zinc-400'
          } ${highlighted ? 'ring-2 ring-zinc-900 border-zinc-900' : ''}`}
        >
          {/* Badge: Substantive rank / Acting overlay */}
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0">
              Rank {node.rank ?? '—'}
            </span>
            {node.isActing && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 truncate">
                Acting Cover
              </span>
            )}
          </div>

          {/* Holder Name & Link */}
          <div className="space-y-0.5 sm:space-y-1">
            <Link
              href={`/dashboard/people/${node.business_membership_id}`}
              className="font-bold text-xs sm:text-sm text-zinc-900 hover:underline transition-colors line-clamp-1 block min-h-[22px]"
            >
              {node.holderName}
            </Link>
            <div className="text-xs font-semibold text-zinc-700 line-clamp-1">
              {node.jobTitleName}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-500 line-clamp-1">
              {node.branchName || 'Corporate'} {node.departmentName ? `• ${node.departmentName}` : ''}
            </div>
          </div>

          {/* Children expand / collapse button */}
          {hasChildren && (
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span className="text-[10px] sm:text-[11px] text-zinc-500">
                {node.children!.length} report{node.children!.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold text-zinc-900 active:scale-95 transition-all touch-manipulation min-h-[28px]"
              >
                {isCollapsed ? 'Expand +' : 'Collapse −'}
              </button>
            </div>
          )}
        </div>

        {/* Tree Connectors & Children */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center mt-5 sm:mt-6">
            <div className="w-0.5 h-5 sm:h-6 bg-zinc-300" />
            <div className="flex items-start justify-center gap-3 sm:gap-6 pt-0 border-t border-zinc-300">
              {node.children!.map((child) => (
                <div key={child.id} className="relative pt-5 sm:pt-6">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-5 sm:h-6 bg-zinc-300" />
                  {renderNodeCard(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDrilldownList = (nodes: OrgTreeNode[], level = 0) => {
    return (
      <div className={`space-y-2.5 ${level > 0 ? 'ml-2 sm:ml-6 pl-2.5 sm:pl-3 border-l-2 border-zinc-200' : ''}`}>
        {nodes.map((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isCollapsed = collapsedNodes.has(node.id);

          return (
            <div key={node.id} className="space-y-2">
              <div className="rounded-xl bg-white border border-zinc-200 p-3 sm:p-4 flex items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                  {hasChildren ? (
                    <button
                      onClick={() => toggleCollapse(node.id)}
                      className="h-8 w-8 min-w-[32px] rounded-lg bg-zinc-100 flex items-center justify-center text-xs text-zinc-800 font-bold hover:bg-zinc-200 active:scale-95 transition-all touch-manipulation shrink-0"
                      aria-label={isCollapsed ? 'Expand direct reports' : 'Collapse direct reports'}
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                  ) : (
                    <span className="w-8 min-w-[32px] flex justify-center text-zinc-300 text-xs select-none">•</span>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/people/${node.business_membership_id}`}
                      className="font-bold text-xs sm:text-sm text-zinc-900 hover:underline truncate block"
                    >
                      {node.holderName}
                    </Link>
                    <div className="text-[11px] text-zinc-500 truncate">
                      <span className="font-semibold text-zinc-700">{node.jobTitleName}</span>
                      {' '}&bull; {node.branchName || 'Corporate'} {node.departmentName ? `• ${node.departmentName}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 hidden sm:inline-block">
                    R{node.rank ?? '—'}
                  </span>
                  {node.isActing && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 font-bold">
                      Acting
                    </span>
                  )}
                  {hasChildren && (
                    <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {node.children!.length} report{node.children!.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {hasChildren && !isCollapsed && renderDrilldownList(node.children!, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  const filteredTree = currentTree.filter((root) => {
    if (selectedBranchId === 'all') return true;
    const branchName = branches.find((b) => b.id === selectedBranchId)?.name;
    return root.branchName === branchName;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Interactive Organization Chart
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Visual hierarchy visualization with dynamic acting coverage overlays and responsive navigation
          </p>
        </div>

        {/* View Mode & Layout Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Substantive vs Effective Toggle */}
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-1 flex items-center text-xs">
            <button
              onClick={() => setViewMode('substantive')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all min-h-[36px] touch-manipulation ${
                viewMode === 'substantive'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Substantive Tree
            </button>
            <button
              onClick={() => setViewMode('effective')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all min-h-[36px] touch-manipulation ${
                viewMode === 'effective'
                  ? 'bg-white text-purple-800 shadow-xs border border-purple-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Effective (Acting Overlay)
            </button>
          </div>

          {/* Tree vs List Layout Toggle */}
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-1 flex items-center text-xs">
            <button
              onClick={() => setLayoutMode('tree')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all min-h-[36px] touch-manipulation ${
                layoutMode === 'tree'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setLayoutMode('drilldown')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all min-h-[36px] touch-manipulation ${
                layoutMode === 'drilldown'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Drill-Down Cards
            </button>
          </div>
        </div>
      </div>

      {/* Search, Branch Filter & Zoom Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Highlight person in hierarchy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
            />
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full sm:w-auto rounded-xl bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
            >
              <option value="all">All Properties & Corporate</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tree Zoom Controls */}
        {layoutMode === 'tree' && (
          <div className="flex items-center justify-end gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl p-1 self-end sm:self-center">
            <button
              type="button"
              onClick={handleZoomOut}
              className="px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-white hover:shadow-2xs rounded-lg active:scale-95 transition-all min-h-[32px] min-w-[32px]"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="text-[11px] font-mono font-bold text-zinc-600 px-1 select-none">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-white hover:shadow-2xs rounded-lg active:scale-95 transition-all min-h-[32px] min-w-[32px]"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            {zoomScale !== 1 && (
              <button
                type="button"
                onClick={handleZoomReset}
                className="px-2 py-1 text-[10px] font-bold text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-all ml-1 min-h-[32px]"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Org Chart Display */}
      {filteredTree.length === 0 ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-8 text-center space-y-2 shadow-sm">
          <span className="text-3xl select-none">📊</span>
          <div className="text-sm font-bold text-zinc-900">No root hierarchy tree established</div>
          <div className="text-xs text-zinc-500 max-w-md mx-auto">
            Assign reporting relationships to active staff members to visualize the organization hierarchy.
          </div>
        </div>
      ) : layoutMode === 'tree' ? (
        <div className="rounded-2xl bg-white border border-zinc-200 p-4 sm:p-8 overflow-x-auto overflow-y-visible min-h-[500px] shadow-sm touch-pan-x touch-pan-y">
          <div
            className="inline-flex flex-col items-center min-w-full space-y-10 pb-12 transition-transform duration-150 origin-top"
            style={{ transform: `scale(${zoomScale})` }}
          >
            {filteredTree.map((root) => (
              <div key={root.id} className="flex justify-center">
                {renderNodeCard(root)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-zinc-200 p-3 sm:p-5 shadow-sm">
          {renderDrilldownList(filteredTree)}
        </div>
      )}
    </div>
  );
}
