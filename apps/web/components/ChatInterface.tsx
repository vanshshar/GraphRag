'use client';

import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  FileCheck2,
  Clock,
  Layers,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { askQuestion, type ChatResponse, type CitationItem } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationItem[];
  insufficientEvidence?: boolean;
  timingMs?: number;
  retrievedCount?: number;
}

interface ChatInterfaceProps {
  onCitationClick: (citation: CitationItem, index: number) => void;
}

export function ChatInterface({ onCitationClick }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleQuestions = [
    'What technology stack does GraphRAG use?',
    'How does Neo4j store provenance claims and chunks?',
    'What is the difference between lexical search and graph traversal?',
  ];

  const handleSend = async (queryText?: string) => {
    const question = (queryText || inputQuery).trim();
    if (!question || isSubmitting) return;

    setError(null);
    setInputQuery('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSubmitting(true);

    try {
      const response = await askQuestion(question);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        insufficientEvidence: response.insufficientEvidence,
        timingMs: response.timingMs,
        retrievedCount: response.retrievedCount,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to query the knowledge graph.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-900">Grounded Graph Assistant</h2>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Evidence-Grounded Querying</span>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Ask questions grounded in your documents</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              GraphRAG retrieves relevant passages through hybrid lexical, semantic, and graph traversal, returning evidence-grounded answers with verifiable citations.
            </p>

            <div className="mt-6 text-left space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Suggested questions:
              </span>
              {sampleQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(sq)}
                  className="w-full text-left p-2.5 text-xs text-slate-700 bg-slate-50 hover:bg-indigo-50/60 hover:text-indigo-900 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors flex items-center justify-between group"
                >
                  <span className="truncate">{sq}</span>
                  <Send className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {/* Message text */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Insufficient evidence badge */}
                {msg.insufficientEvidence && (
                  <div className="mt-3 flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Insufficient evidence in the indexed documents to assert a definitive answer.</span>
                  </div>
                )}

                {/* Citations list */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Grounded Citations ({msg.citations.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c, idx) => (
                        <button
                          key={c.evidenceId + idx}
                          onClick={() => onCitationClick(c, idx)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition-colors shadow-2xs"
                        >
                          <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[140px] font-mono text-[11px]">
                            {c.documentTitle || c.evidenceId}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Message telemetry */}
              {msg.role === 'assistant' && msg.timingMs !== undefined && (
                <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1.5 px-1 font-mono">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{msg.timingMs}ms</span>
                  </div>
                  {msg.retrievedCount !== undefined && (
                    <>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Layers className="h-3 w-3" />
                        <span>{msg.retrievedCount} candidates retrieved</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isSubmitting && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3 rounded-xl max-w-sm">
            <Sparkles className="h-4 w-4 text-indigo-600 animate-spin" />
            <span>Retrieving graph paths and generating grounded answer...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Ask a question about the indexed knowledge graph..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isSubmitting}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm shadow-indigo-100 shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}

