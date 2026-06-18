// ==========================================
// COMPONENTE DE BOLHA DE MENSAGEM
// ==========================================

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types/financial';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  if (message.isTyping) {
    return (
      <div className="message-wrapper ai">
        <div className="message-avatar ai">🤖</div>
        <div className="message-content">
          <div className="message-bubble ai">
            <div className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timeString = message.timestamp instanceof Date
    ? message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'ai'}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'ai'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
          {isUser ? (
            // Mensagens do usuário: texto simples
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          ) : (
            // Mensagens da IA: markdown renderizado (limpando qualquer lixo de financial_data do histórico)
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Evita que links abram na mesma aba
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--color-text-accent)' }}>
                    {children}
                  </a>
                ),
                // Tabela com wrapper para scroll e visualização premium
                table: ({ children }) => (
                  <div className="table-container">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {message.content.replace(/<financial_data>[\s\S]*/gi, '').trim()}
            </ReactMarkdown>
          )}
        </div>
        <span className="message-time">{timeString}</span>
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
