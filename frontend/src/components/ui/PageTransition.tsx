import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
}

const pageVariants = {
    initial: {
        opacity: 0,
        pointerEvents: 'none',
    },
    in: {
        opacity: 1,
        pointerEvents: 'auto',
    },
    out: {
        opacity: 0,
        pointerEvents: 'none',
    },
};

const pageTransition = {
    type: 'tween',
    ease: 'easeInOut',
    duration: 0.18,
} as const;

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
        transition={pageTransition}
        style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0
        }}
    >
            {children}
        </motion.div>
    );
};
