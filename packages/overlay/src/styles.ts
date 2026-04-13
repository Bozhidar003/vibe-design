export const OVERLAY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    all: initial;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #c4cdd8;
    line-height: 1.5;
  }

  /* ─── Element Highlight ──────────────────────────────────── */

  .vibe-highlight {
    position: fixed;
    pointer-events: none;
    border: 2px solid rgba(217, 119, 87, 0.8);
    background: rgba(217, 119, 87, 0.04);
    border-radius: 3px;
    z-index: 2147483646;
    transition: all 0.08s ease-out;
  }

  .vibe-label {
    position: fixed;
    background: rgba(15, 15, 20, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #e0e4ea;
    font-size: 11px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.06);
    z-index: 2147483646;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }

  .vibe-label .vibe-label-name {
    color: #e8a88a;
    font-weight: 500;
  }

  .vibe-label .vibe-label-path {
    color: #6b7280;
    margin-left: 6px;
    font-size: 10px;
  }

  /* ─── Floating Action Button ─────────────────────────────── */

  .vibe-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: rgba(15, 15, 20, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.3),
      0 8px 24px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 2147483647;
  }

  .vibe-fab:hover {
    background: rgba(25, 25, 35, 0.9);
    border-color: rgba(255,255,255,0.12);
    color: #e0e4ea;
    transform: translateY(-1px);
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.3),
      0 12px 32px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .vibe-fab.active {
    background: rgba(217, 119, 87, 0.12);
    border-color: rgba(217, 119, 87, 0.25);
    color: #e8a88a;
    box-shadow:
      0 0 0 1px rgba(217,119,87,0.15),
      0 8px 24px rgba(217,119,87,0.12),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }

  /* ─── Panel ──────────────────────────────────────────────── */

  .vibe-panel {
    position: fixed;
    bottom: 80px;
    right: 24px;
    width: 420px;
    max-height: calc(100vh - 120px);
    background: rgba(12, 12, 16, 0.92);
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.5),
      0 24px 80px rgba(0,0,0,0.55),
      0 8px 24px rgba(0,0,0,0.3);
    pointer-events: auto;
    overflow: hidden;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
  }

  /* ─── Panel Header ──────────────────────────────────────── */

  .vibe-panel-header {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vibe-panel-header-info {
    flex: 1;
    min-width: 0;
  }

  .vibe-panel-header-name {
    font-weight: 600;
    color: #eef0f4;
    font-size: 13px;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vibe-panel-header-path {
    font-size: 11px;
    color: #555d6b;
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
  }

  .vibe-panel-header-style {
    font-size: 10px;
    color: #555d6b;
    font-family: 'JetBrains Mono', monospace;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .vibe-panel-close {
    background: none;
    border: none;
    color: #4a5265;
    cursor: pointer;
    font-size: 15px;
    padding: 2px 4px;
    line-height: 1;
    pointer-events: auto;
    border-radius: 5px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .vibe-panel-close:hover {
    color: #c4cdd8;
    background: rgba(255,255,255,0.05);
  }

  /* ─── Panel Body ─────────────────────────────────────────── */

  .vibe-panel-body {
    padding: 12px 16px 16px;
    overflow-y: auto;
    flex: 1;
  }

  .vibe-classes-row {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: #7a8494;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    padding: 6px 10px;
    border-radius: 8px;
    margin-bottom: 12px;
    word-break: break-all;
    line-height: 1.6;
  }

  .vibe-meta-tag {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.05);
    color: #7a8494;
    font-family: 'JetBrains Mono', monospace;
  }

  /* ─── Quick Actions ──────────────────────────────────────── */

  .vibe-section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a5265;
    margin-bottom: 8px;
    margin-top: 14px;
  }

  .vibe-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 14px;
  }

  .vibe-quick-btn {
    font-size: 11px;
    padding: 4px 9px;
    border-radius: 7px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    color: #8891a0;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.15s ease;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .vibe-quick-btn:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
    color: #c4cdd8;
  }

  .vibe-quick-btn.active {
    background: rgba(217,119,87,0.08);
    border-color: rgba(217,119,87,0.25);
    color: #e8a88a;
  }

  /* ─── Textarea ───────────────────────────────────────────── */

  .vibe-textarea {
    width: 100%;
    min-height: 64px;
    max-height: 140px;
    resize: vertical;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 12px;
    color: #e0e4ea;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    pointer-events: auto;
    line-height: 1.5;
  }

  .vibe-textarea:focus {
    border-color: rgba(217,119,87,0.35);
    box-shadow: 0 0 0 3px rgba(217,119,87,0.06);
  }

  .vibe-textarea::placeholder {
    color: #3d4555;
  }

  /* ─── Constraints ────────────────────────────────────────── */

  .vibe-constraints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 10px;
  }

  .vibe-constraint {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #6b7280;
    cursor: pointer;
    pointer-events: auto;
    transition: color 0.15s;
  }

  .vibe-constraint:hover {
    color: #9ca3af;
  }

  .vibe-constraint input[type="checkbox"] {
    accent-color: #d97757;
    pointer-events: auto;
    width: 13px;
    height: 13px;
  }

  /* ─── Preview ────────────────────────────────────────────── */

  .vibe-preview-toggle {
    margin-top: 10px;
    font-size: 11px;
    color: #4a5265;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
    font-weight: 500;
    transition: color 0.15s;
  }

  .vibe-preview-toggle:hover {
    color: #7a8494;
  }

  .vibe-preview-content {
    margin-top: 8px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: #6b7280;
    max-height: 240px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }

  /* ─── Footer ─────────────────────────────────────────────── */

  .vibe-panel-footer {
    padding: 10px 16px;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0,0,0,0.15);
  }

  .vibe-screenshot-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #4a5265;
    cursor: pointer;
    pointer-events: auto;
  }

  .vibe-screenshot-toggle input[type="checkbox"] {
    accent-color: #d97757;
    pointer-events: auto;
  }

  .vibe-submit-btn {
    padding: 7px 14px;
    border-radius: 9px;
    background: #d97757;
    border: 1px solid rgba(255,255,255,0.1);
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    pointer-events: auto;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    letter-spacing: -0.01em;
    box-shadow:
      0 1px 2px rgba(0,0,0,0.2),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }

  .vibe-submit-btn:hover {
    background: #c56a4e;
    transform: translateY(-0.5px);
    box-shadow:
      0 4px 12px rgba(217,119,87,0.25),
      inset 0 1px 0 rgba(255,255,255,0.12);
  }

  .vibe-submit-btn:active {
    transform: translateY(0);
  }

  .vibe-submit-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  .vibe-submit-kbd {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(255,255,255,0.12);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
  }

  /* ─── Status Bar ─────────────────────────────────────────── */

  .vibe-status-bar {
    padding: 8px 16px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(0,0,0,0.2);
    border-top: 1px solid rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: -0.01em;
  }

  .vibe-status-bar.pending { color: #f59e0b; }
  .vibe-status-bar.working { color: #e8a88a; }
  .vibe-status-bar.done { color: #34d399; }
  .vibe-status-bar.error { color: #f87171; }

  .vibe-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .vibe-status-bar.working .vibe-status-dot {
    animation: vibe-pulse 1.2s ease-in-out infinite;
  }

  @keyframes vibe-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.85); }
  }

  .vibe-status-message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ─── Multi-select ───────────────────────────────────────── */

  .vibe-highlight-multi {
    border-color: rgba(168, 85, 247, 0.7) !important;
    background: rgba(168, 85, 247, 0.05) !important;
  }

  .vibe-highlight-hover {
    border-color: rgba(217, 119, 87, 0.5) !important;
    border-style: dashed !important;
  }

  .vibe-label-multi .vibe-label-name {
    color: #c4b5fd;
  }

  .vibe-multi-select-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 12px;
    max-height: 100px;
    overflow-y: auto;
  }

  .vibe-multi-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 6px;
    font-size: 11px;
  }

  .vibe-multi-item .vibe-label-name {
    color: #c4b5fd;
    font-weight: 600;
    font-size: 11px;
  }

  .vibe-multi-item .vibe-meta-tag {
    font-size: 10px;
    color: #555d6b;
  }

  /* ─── Simple Mode Panel ───────────────────────────────────── */

  .vibe-simple-panel {
    position: fixed;
    width: 320px;
    background: rgba(12, 12, 16, 0.94);
    backdrop-filter: blur(40px) saturate(1.4);
    -webkit-backdrop-filter: blur(40px) saturate(1.4);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.5),
      0 16px 48px rgba(0,0,0,0.5);
    pointer-events: auto;
    z-index: 2147483647;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vibe-simple-label {
    font-size: 12px;
    font-weight: 500;
    color: #8891a0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vibe-simple-input {
    width: 100%;
    min-height: 36px;
    max-height: 120px;
    resize: none;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 8px 10px;
    color: #e0e4ea;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.15s;
    pointer-events: auto;
    line-height: 1.4;
  }

  .vibe-simple-input:focus {
    border-color: rgba(217,119,87,0.35);
  }

  .vibe-simple-input::placeholder {
    color: #3d4555;
  }

  .vibe-simple-footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vibe-simple-send {
    padding: 5px 12px;
    border-radius: 7px;
    background: #d97757;
    border: 1px solid rgba(255,255,255,0.1);
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .vibe-simple-send:hover {
    background: #c56a4e;
  }

  .vibe-simple-send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .vibe-simple-status {
    font-size: 11px;
    color: #555d6b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vibe-simple-status.working {
    color: #e8a88a;
  }

  .vibe-simple-status.done {
    color: #34d399;
  }

  .vibe-simple-status.error {
    color: #f87171;
  }

  /* ─── Scrollbar ──────────────────────────────────────────── */

  ::-webkit-scrollbar {
    width: 5px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.14);
  }
`
