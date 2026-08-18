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

  const currentTree = viewMode === 'substantive' ? tree : effectiveTree;

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          className={`relative w-64 rounded-2xl p-4 border transition-all duration-200 shadow-lg ${
            node.isActing
              ? 'bg-purple-950/30 border-purple-800/80 shadow-purple-950/40'
              : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 shadow-black/40'
          } ${highlighted ? 'ring-2 ring-emerald-400 border-emerald-400' : ''}`}
        >
          {/* Badge: Substantive rank / Acting overlay */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              Rank {node.rank ?? '—'}
            </span>
            {node.isActing && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-700/80 animate-pulse">
                🎭 Acting Cover
              </span>
            )}
          </div>

          {/* Holder Name & Link */}
          <div className="space-y-1">
            <Link
              href={`/dashboard/people/${node.business_membership_id}`}
              className="font-bold text-sm text-zinc-100 hover:text-emerald-400 transition-colors line-clamp-1"
            >
              {node.holderName}
            </Link>
            <div className="text-xs font-medium text-emerald-400 line-clamp-1">
              {node.jobTitleName}
            </div>
            <div className="text-[11px] text-zinc-400 line-clamp-1">
              {node.branchName || 'Corporate'} {node.departmentName ? `• ${node.departmentName}` : ''}
            </div>
          </div>

          {/* Children expand / collapse button */}
          {hasChildren && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span className="text-[11px] text-zinc-500">
                {node.children!.length} direct report{node.children!.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {isCollapsed ? 'Expand +' : 'Collapse −'}
              </button>
            </div>
          )}
        </div>

        {/* Tree Connectors & Children */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center mt-6">
            <div className="w-0.5 h-6 bg-zinc-800" />
            <div className="flex items-start justify-center gap-6 pt-0 border-t border-zinc-800">
              {node.children!.map((child) => (
                <div key={child.id} className="relative pt-6">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-zinc-800" />
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
      <div className={`space-y-2.5 ${level > 0 ? 'ml-4 md:ml-6 pl-3 border-l-2 border-zinc-800' : ''}`}>
        {nodes.map((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isCollapsed = collapsedNodes.has(node.id);

          return (
            <div key={node.id} className="space-y-2">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800/80 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  {hasChildren && (
                    <button
                      onClick={() => toggleCollapse(node.id)}
                      className="h-6 w-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400"
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                  )}
                  <div>
                    <Link
                      href={`/dashboard/people/${node.business_membership_id}`}
                      className="font-bold text-xs text-zinc-100 hover:text-emerald-400"
                    >
                      👤 {node.holderName}
                    </Link>
                    <div className="text-[11px] text-zinc-400">
                      {node.jobTitleName} • {node.branchName || 'Corporate'} {node.departmentName ? `• ${node.departmentName}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {node.isActing && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-semibold">
                      Acting
                    </span>
                  )}
                  {hasChildren && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {node.children!.length} direct
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Interactive Organization Chart
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visual hierarchy visualization with dynamic acting coverage overlays and recursive tree navigation
          </p>
        </div>

        {/* View Mode & Layout Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Substantive vs Effective Toggle */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-1 flex items-center text-xs">
            <button
              onClick={() => setViewMode('substantive')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'substantive'
                  ? 'bg-zinc-800 text-zinc-100 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Substantive Tree
            </button>
            <button
              onClick={() => setViewMode('effective')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'effective'
                  ? 'bg-purple-900/80 text-purple-200 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🎭 Effective (Acting Overlay)
            </button>
          </div>

          {/* Tree vs List Layout Toggle */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-1 flex items-center text-xs">
            <button
              onClick={() => setLayoutMode('tree')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                layoutMode === 'tree'
                  ? 'bg-zinc-800 text-zinc-100 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setLayoutMode('drilldown')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                layoutMode === 'drilldown'
                  ? 'bg-zinc-800 text-zinc-100 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Drill-Down Cards
            </button>
          </div>
        </div>
      </div>

      {/* Search and Branch Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Highlight person in hierarchy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="w-full sm:w-auto">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full sm:w-auto rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

      {/* Org Chart Display */}
      {filteredTree.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-8 text-center space-y-2">
          <span className="text-3xl">📊</span>
          <div className="text-sm font-semibold text-zinc-300">No root hierarchy tree established</div>
          <div className="text-xs text-zinc-500">
            Set reporting relationships in staff assignments to generate the visual organization chart.
          </div>
        </div>
      ) : layoutMode === 'tree' ? (
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 md:p-8 overflow-x-auto min-h-[500px]">
          <div className="inline-flex flex-col items-center min-w-full space-y-12 pb-12">
            {filteredTree.map((root) => (
              <div key={root.id} className="flex justify-center">
                {renderNodeCard(root)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5">
          {renderDrilldownList(filteredTree)}
        </div>
      )}
    </div>
  );
}
