import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Network, Heart, FileText, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DocumentDetailPanel, ChainNode } from './DocumentDetailPanel';
import { useModelConfig } from '../../contexts/ModelConfigContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface EvidenceGraphModalProps {
    isOpen: boolean;
    onClose: () => void;
    messageId: string;
    nodes?: ChainNode[];
}

export const EvidenceGraphModal: React.FC<EvidenceGraphModalProps> = ({ isOpen, onClose, messageId, nodes: providedNodes }) => {
    const { t } = useTranslation();
    const [isFavorite, setIsFavorite] = useState(false);

    const { enableTuning } = useModelConfig();
    const { confirm } = useConfirm();

    // Graph/Node State
    const [nodes, setNodes] = useState<ChainNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);  
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (providedNodes && providedNodes.length > 0) {
            setNodes(providedNodes);
        } else {
            setNodes([]);
        }
        setSelectedNodeId(null);
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
    }, [providedNodes, messageId]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
    const zoomBounds = { min: 0.6, max: 2.4 };

    const handleWeightChange = (newWeight: number) => {
        if (!selectedNodeId) return;
        setNodes(prev => prev.map(n =>
            n.id === selectedNodeId
                ? { ...n, metadata: { ...n.metadata, relevance: newWeight } }
                : n
        ));
    };

    const clampZoom = (value: number) => Math.min(zoomBounds.max, Math.max(zoomBounds.min, value));

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const direction = event.deltaY < 0 ? 1.08 : 0.92;
        setZoom(prev => clampZoom(prev * direction));
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('button')) return;
        if (event.button !== 0) return;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const dx = event.clientX - dragStartRef.current.x;
        const dy = event.clientY - dragStartRef.current.y;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        dragStartRef.current = null;
        setIsDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const resetView = () => {
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
    };

    const zoomIn = () => setZoom(prev => clampZoom(prev * 1.1));
    const zoomOut = () => setZoom(prev => clampZoom(prev * 0.9));

    const handlePreview = async () => {
        if (!selectedNode) return;
        await confirm({
            title: t('evidenceModal.previewTitle'),
            message: t('evidenceModal.previewMessage', {
                page: selectedNode.metadata.page,
                file: selectedNode.metadata.fileName,
            }),
            type: 'info',
            confirmText: t('common.ok'),
            hideCancel: true,
        });
    };

    const handleJump = () => {
        if (selectedNode) {
            console.log(`Jumping to node ${selectedNode.id}`);
            // In a real graph, this would center the view on the node
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 100
                        }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
                        animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            width: '90%',
                            maxWidth: '1000px',
                            height: '85vh',
                            backgroundColor: 'var(--color-surface)',
                            borderRadius: '16px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            zIndex: 101,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid var(--color-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: 'var(--color-bg)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    padding: '8px',
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--color-primary-light)',
                                    color: 'var(--color-primary)'
                                }}>
                                    <Network size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{t('evidenceModal.title')}</h3>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {t('evidenceModal.subtitle', { id: messageId.slice(-6) })}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setIsFavorite(!isFavorite)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        borderRadius: '50%',
                                        color: isFavorite ? '#ef4444' : 'var(--color-text-muted)',
                                        transition: 'all 0.2s',
                                        backgroundColor: isFavorite ? '#fee2e2' : 'transparent'
                                    }}
                                    title={t('evidenceModal.saveFavorite')}
                                >
                                    <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        color: 'var(--color-text-muted)'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Graph Visualization Area */}
                            <div style={{
                                flex: 1,
                                padding: '24px',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isFavorite ? 'var(--color-bg)' : 'var(--color-surface)',
                                overflow: 'hidden' // contain graph
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '18px',
                                    right: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    zIndex: 30
                                }}>
                                    <button
                                        onClick={zoomIn}
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--color-border)',
                                            backgroundColor: 'var(--color-surface)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--color-text)'
                                        }}
                                        title={t('evidenceModal.zoomIn')}
                                    >
                                        <ZoomIn size={16} />
                                    </button>
                                    <button
                                        onClick={zoomOut}
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--color-border)',
                                            backgroundColor: 'var(--color-surface)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--color-text)'
                                        }}
                                        title={t('evidenceModal.zoomOut')}
                                    >
                                        <ZoomOut size={16} />
                                    </button>
                                    <button
                                        onClick={resetView}
                                        style={{
                                            width: '34px',
                                            height: '34px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--color-border)',
                                            backgroundColor: 'var(--color-surface)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--color-text)'
                                        }}
                                        title={t('evidenceModal.resetView')}
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                                {/* Interactive Graph Visualization (Mock) */}
                                <div
                                    onWheel={handleWheel}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerLeave={handlePointerUp}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: isDragging ? 'grabbing' : 'grab',
                                        touchAction: 'none'
                                    }}
                                >
                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                                        transformOrigin: 'center center',
                                        transition: isDragging ? 'none' : 'transform 0.15s ease'
                                    }}>
                                    {/* Central Hub */}
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--color-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                        zIndex: 10
                                    }}>
                                        <Network size={32} />
                                    </div>

                                    {/* Nodes */}
                                    {nodes.map((node, index) => {
                                        const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
                                        const radius = 180;
                                        const x = Math.cos(angle) * radius;
                                        const y = Math.sin(angle) * radius;

                                        const isSelected = selectedNodeId === node.id;

                                        return (
                                            <React.Fragment key={node.id}>
                                                {/* Connecting Line */}
                                                <svg style={{ position: 'absolute', top: '50%', left: '50%', overflow: 'visible', pointerEvents: 'none' }}>
                                                    <line
                                                        x1={0} y1={0}
                                                        x2={x} y2={y}
                                                        stroke={isSelected ? 'var(--color-primary)' : 'var(--color-border)'}
                                                        strokeWidth={2}
                                                        strokeDasharray="4 4"
                                                    />
                                                </svg>

                                                {/* Node Element */}
                                                <motion.button
                                                    onClick={() => setSelectedNodeId(node.id)}
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    animate={{
                                                        scale: isSelected ? 1.1 : 1,
                                                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                                                        boxShadow: isSelected ? '0 0 0 4px var(--color-primary-light)' : 'none'
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `calc(50% + ${x}px)`,
                                                        top: `calc(50% + ${y}px)`,
                                                        transform: 'translate(-50%, -50%)',
                                                        padding: '12px',
                                                        borderRadius: '12px',
                                                        backgroundColor: 'var(--color-surface)',
                                                        border: '2px solid',
                                                        borderColor: 'var(--color-border)', // animate handles overide
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        width: '140px',
                                                        zIndex: 20
                                                    }}
                                                >
                                                    <div style={{ color: 'var(--color-primary)' }}>
                                                        <FileText size={24} />
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', textAlign: 'center', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                                        {node.label}
                                                    </span>
                                                    {enableTuning && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '-8px',
                                                            right: '-8px',
                                                            backgroundColor: 'var(--color-primary)',
                                                            color: 'white',
                                                            fontSize: '0.7rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '10px',
                                                            fontWeight: 600
                                                        }}>
                                                            {(node.metadata.relevance * 100).toFixed(0)}%
                                                        </div>
                                                    )}
                                                </motion.button>
                                            </React.Fragment>
                                        );
                                    })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar - Document Details */}
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: '350px', opacity: 1 }}
                                style={{
                                    borderLeft: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}
                            >
                                <DocumentDetailPanel
                                    node={selectedNode}
                                    enableTuning={enableTuning}
                                    onWeightChange={handleWeightChange}
                                    onPreview={handlePreview}
                                    onJump={handleJump}
                                />
                            </motion.div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

