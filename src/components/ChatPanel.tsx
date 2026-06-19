// ==========================================
// PAINEL DE CHAT CONVERSACIONAL
// ==========================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Message, MessageAttachment } from '../types/financial';
import MessageBubble from './MessageBubble';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;

    setAttachmentError('');

    if (file.type !== 'application/pdf') {
      setAttachmentError('Apenas arquivos PDF são aceitos.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAttachmentError('O arquivo deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result vem como "data:application/pdf;base64,XXXXX" — extrai só a parte base64
      const base64 = result.split(',')[1] || '';
      setPendingAttachment({
        mimeType: file.type,
        data: base64,
        fileName: file.name,
      });
    };
    reader.onerror = () => {
      setAttachmentError('Não foi possível ler o arquivo. Tente novamente.');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if ((!trimmed && !pendingAttachment) || isLoading || isProcessingDocument) return;

    // Caso 1: há um documento anexado — processa numa chamada isolada,
    // dedicada, que nunca entra no histórico do chat. Só o resumo em
    // texto resultante é enviado como mensagem normal.
    if (pendingAttachment) {
      setIsProcessingDocument(true);
      setAttachmentError('');
      try {
        const response = await fetch('/api/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mimeType: pendingAttachment.mimeType,
            data: pendingAttachment.data,
            fileName: pendingAttachment.fileName,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errData.error || `Erro HTTP ${response.status}`);
        }

        const result = await response.json();
        const summary: string = result.summary || 'Documento processado.';
        const extractedDataJson: string | null = result.extractedData || null;

        // Monta a mensagem que entra no chat: o resumo em texto, seguido
        // (se houver) dos dados extraídos como contexto explícito para a
        // IA usar na próxima resposta — mas como TEXTO, não como anexo.
        const messageContent = extractedDataJson
          ? `📄 Documento anexado: ${pendingAttachment.fileName}\n\n${summary}\n\n[Dados extraídos do documento para referência: ${extractedDataJson}]`
          : `📄 Documento anexado: ${pendingAttachment.fileName}\n\n${summary}`;

        onSendMessage(trimmed ? `${trimmed}\n\n${messageContent}` : messageContent);

        setPendingAttachment(null);
        setInputValue('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (err: any) {
        setAttachmentError(err.message || 'Erro ao processar o documento. Tente novamente.');
      } finally {
        setIsProcessingDocument(false);
      }
      return;
    }

    // Caso 2: mensagem de texto normal, sem anexo
    onSendMessage(trimmed);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, isProcessingDocument, onSendMessage, pendingAttachment]);

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
        {pendingAttachment && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              marginBottom: '8px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              width: 'fit-content',
            }}
          >
            <span>📄 {pendingAttachment.fileName}</span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              aria-label="Remover anexo"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                fontSize: '0.9rem',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )}
        {attachmentError && (
          <p className="modal-error" role="alert" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
            ⚠️ {attachmentError}
          </p>
        )}
        <div className="chat-input-wrapper">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingDocument}
            aria-label="Anexar fatura ou extrato em PDF"
            title="Anexar PDF (fatura/extrato)"
            style={{
              background: 'none',
              border: 'none',
              cursor: (isLoading || isProcessingDocument) ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (isLoading || isProcessingDocument) ? 0.5 : 1,
              fontSize: '1.4rem',
              lineHeight: 1,
              width: '36px',
              height: '36px',
              flexShrink: 0,
            }}
          >
            📎
          </button>
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="chat-textarea"
            placeholder={isProcessingDocument ? 'Lendo o documento...' : 'Digite sua resposta...'}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading || isProcessingDocument}
            aria-label="Campo de mensagem"
          />
          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={(!inputValue.trim() && !pendingAttachment) || isLoading || isProcessingDocument}
            aria-label="Enviar mensagem"
            title="Enviar (Enter)"
          >
            {(isLoading || isProcessingDocument) ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        {isProcessingDocument && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
            📄 Lendo seu documento, isso pode levar alguns segundos...
          </p>
        )}
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
