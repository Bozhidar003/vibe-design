export const OVERLAY_STYLES = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #e2e8f0;
  }

  .vibe-highlight {
    position: fixed;
    pointer-events: none;
    border: 2px solid #3b82f6;
    border-radius: 4px;
    z-index: 2147483646;
    transition: all 0.1s ease;
  }

  .vibe-label {
    position: fixed;
    background: #1e293b;
    color: #e2e8f0;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    padding: 4px 8px;
    border-radius: 4px;
    z-index: 2147483646;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .vibe-label .vibe-label-name {
    color: #60a5fa;
    font-weight: 600;
  }

  .vibe-label .vibe-label-path {
    color: #94a3b8;
    margin-left: 6px;
  }

  .vibe-fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1e293b;
    border: 2px solid #334155;
    color: #e2e8f0;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    z-index: 2147483647;
  }

  .vibe-fab:hover {
    background: #334155;
    transform: scale(1.1);
  }

  .vibe-fab.active {
    background: #3b82f6;
    border-color: #60a5fa;
  }

  .vibe-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 440px;
    max-height: calc(100vh - 120px);
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    pointer-events: auto;
    overflow: hidden;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
  }

  .vibe-panel-header {
    padding: 16px;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .vibe-panel-header-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #1e3a5f;
    color: #60a5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .vibe-panel-header-info {
    flex: 1;
    min-width: 0;
  }

  .vibe-panel-header-name {
    font-weight: 600;
    color: #f1f5f9;
    font-size: 15px;
  }

  .vibe-panel-header-path {
    font-size: 12px;
    color: #64748b;
    font-family: 'SF Mono', 'Fira Code', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vibe-panel-header-usages {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  .vibe-panel-close {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    line-height: 1;
    pointer-events: auto;
  }

  .vibe-panel-close:hover {
    color: #e2e8f0;
  }

  .vibe-panel-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .vibe-meta-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .vibe-meta-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #1e293b;
    color: #94a3b8;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .vibe-meta-tag.computed {
    color: #a78bfa;
  }

  .vibe-meta-tag.parent {
    color: #34d399;
  }

  .vibe-section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-bottom: 8px;
    margin-top: 16px;
  }

  .vibe-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }

  .vibe-quick-btn {
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 6px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.15s ease;
  }

  .vibe-quick-btn:hover {
    background: #334155;
    border-color: #475569;
    color: #f1f5f9;
  }

  .vibe-quick-btn.active {
    background: #1e3a5f;
    border-color: #3b82f6;
    color: #60a5fa;
  }

  .vibe-textarea {
    width: 100%;
    min-height: 72px;
    max-height: 160px;
    resize: vertical;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
    color: #f1f5f9;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease;
    pointer-events: auto;
  }

  .vibe-textarea:focus {
    border-color: #3b82f6;
  }

  .vibe-textarea::placeholder {
    color: #475569;
  }

  .vibe-constraints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .vibe-constraint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #94a3b8;
    cursor: pointer;
    pointer-events: auto;
  }

  .vibe-constraint input[type="checkbox"] {
    accent-color: #3b82f6;
    pointer-events: auto;
  }

  .vibe-preview-toggle {
    margin-top: 12px;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
  }

  .vibe-preview-toggle:hover {
    color: #94a3b8;
  }

  .vibe-preview-content {
    margin-top: 8px;
    background: #020617;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #94a3b8;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .vibe-panel-footer {
    padding: 12px 16px;
    border-top: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .vibe-screenshot-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
    pointer-events: auto;
  }

  .vibe-screenshot-toggle input[type="checkbox"] {
    accent-color: #3b82f6;
    pointer-events: auto;
  }

  .vibe-submit-btn {
    padding: 8px 16px;
    border-radius: 8px;
    background: #3b82f6;
    border: none;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
    transition: all 0.15s ease;
  }

  .vibe-submit-btn:hover {
    background: #2563eb;
  }

  .vibe-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .vibe-submit-kbd {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(255,255,255,0.15);
  }

  .vibe-status-bar {
    padding: 8px 16px;
    font-size: 12px;
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vibe-status-bar.pending { color: #fbbf24; }
  .vibe-status-bar.working { color: #60a5fa; }
  .vibe-status-bar.done { color: #34d399; }
  .vibe-status-bar.error { color: #f87171; }

  .vibe-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .vibe-status-bar.working .vibe-status-dot {
    animation: vibe-pulse 1s infinite;
  }

  @keyframes vibe-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .vibe-classes-row {
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #fbbf24;
    background: #1e293b;
    padding: 6px 10px;
    border-radius: 6px;
    margin-bottom: 8px;
    word-break: break-all;
  }

  /* Multi-select styles */
  .vibe-highlight-multi {
    border-color: #a855f7 !important;
    border-width: 2px;
    background: rgba(168, 85, 247, 0.08);
  }

  .vibe-highlight-hover {
    border-color: #3b82f6 !important;
    border-style: dashed !important;
  }

  .vibe-label-multi .vibe-label-name {
    color: #c084fc;
  }

  .vibe-multi-select-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    max-height: 120px;
    overflow-y: auto;
  }

  .vibe-multi-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: #1e293b;
    border-radius: 6px;
    font-size: 12px;
  }

  .vibe-multi-item .vibe-label-name {
    color: #c084fc;
    font-weight: 600;
  }

  .vibe-multi-item .vibe-meta-tag {
    font-size: 11px;
    color: #64748b;
  }
`
