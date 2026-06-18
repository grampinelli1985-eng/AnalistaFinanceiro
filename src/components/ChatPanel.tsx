// ==========================================
// PAINEL DE CHAT CONVERSACIONAL
// ==========================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message } from '../types/financial';
import MessageBubble from './MessageBubble';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onClearChat: () => void;
  onResetData: () => void;
  className?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onClearChat,
  onResetData,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize do textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Reset height para recalcular
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInputValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`chat-panel ${className}`}>
      {/* Área de Mensagens */}
      <div className="chat-messages" id="chat-messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">Carregando...</div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Área de Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="chat-textarea"
            placeholder="Digite sua resposta..."
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
            aria-label="Campo de mensagem"
          />
          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Enviar mensagem"
            title="Enviar (Enter)"
          >
            {isLoading ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <div className="chat-hint">
          Pressione <strong>Enter</strong> para enviar · <strong>Shift+Enter</strong> para nova linha
          {messages.length > 2 && (
            <span style={{ marginLeft: '8px' }}>
              <span
                style={{ cursor: 'pointer', color: 'var(--color-text-muted)', textDecoration: 'underline' }}
                onClick={onClearChat}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onClearChat()}
              >
                · Reiniciar conversa
              </span>
              <span style={{ margin: '0 8px', color: 'var(--color-text-muted)', opacity: 0.5 }}>|</span>
              <span
                style={{ cursor: 'pointer', color: 'var(--color-critical)', textDecoration: 'underline' }}
                onClick={onResetData}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onResetData()}
              >
                Nova Análise (Zerar tudo)
              </span>
            </span>
          )}
        </div>
        <div 
          className="chat-disclaimer" 
          style={{ 
            fontSize: '0.7rem', 
            color: 'var(--color-text-muted)', 
            textAlign: 'center', 
            marginTop: '6px', 
            opacity: 0.8 
          }}
        >
          ⚠️ Análises geradas por IA. Não constituem aconselhamento financeiro profissional.
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
