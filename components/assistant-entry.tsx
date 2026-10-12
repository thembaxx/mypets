'use client';
import { motion } from 'motion/react';
import { ArrowUpRightIcon, ChatCircleDotsIcon } from '@phosphor-icons/react';
import type { Pet } from '@/lib/care';

export function AssistantEntry({ pet, onOpen }: { pet: Pet; onOpen: () => void }) {
  return (
    <motion.button
      className="assistant-entry"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      aria-label={`Ask about ${pet.name}`}
    >
      <span className="assistant-entry-icon">
        <ChatCircleDotsIcon size={27} />
      </span>
      <span>
        <strong>A little help, close by.</strong>
        <small>Ask about {pet.name} · care, learning, and your recorded month.</small>
      </span>
      <span className="assistant-entry-arrow">
        <ArrowUpRightIcon size={22} />
      </span>
    </motion.button>
  );
}
