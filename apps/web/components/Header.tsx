'use client';

import React from 'react';
import { Database, Network, Cpu, HardDrive } from 'lucide-react';
import type { SystemReadiness, GraphStats } from '../lib/api';

interface HeaderProps {
  readiness?: SystemReadiness | null;
  stats?: GraphStats | null;
  onRefreshStats: () => void;
}

export function Header({ readiness, stats }: HeaderProps) {
  const isHealthy = readiness?.status === 'ready';

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">GraphRAG</span>
              <span className="font-medium text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Knowledge Assistant
              </span>
            </div>
            <p className="text-xs text-slate-500">Source-grounded knowledge assistant</p>
          </div>
        </div>

        {/* System telemetry & Graph Metrics */}
        <div className="flex items-center space-x-4">
          {stats && (
            <div className="hidden md:flex items-center space-x-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
              <div className="flex items-center space-x-1.5" title="Documents in Knowledge Graph">
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                <span><strong className="text-slate-800">{stats.documentCount}</strong> docs</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center space-x-1.5" title="Chunks indexed">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                <span><strong className="text-slate-800">{stats.chunkCount}</strong> chunks</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center space-x-1.5" title="Entities extracted">
                <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                <span><strong className="text-slate-800">{stats.entityCount}</strong> entities</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center space-x-1.5" title="Claims & Relationships">
                <Network className="h-3.5 w-3.5 text-indigo-500" />
                <span><strong className="text-slate-800">{stats.claimCount}</strong> claims</span>
              </div>
            </div>
          )}

          {/* Readiness Indicator */}
          <div className="flex items-center space-x-2 text-xs">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isHealthy ? 'bg-emerald-500 shadow-sm shadow-emerald-200 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-slate-700 hidden sm:inline">
              {isHealthy ? 'Neo4j & Engine Online' : 'Local Engine Ready'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

