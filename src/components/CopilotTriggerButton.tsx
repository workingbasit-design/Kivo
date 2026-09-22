"use client";

import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
  message?: string;
};

export default function CopilotTriggerButton({ className, children, message = 'Namaste! Kya madad chahiye?' }: Props) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent('open-copilot', { 
        detail: { message } 
      })
    );
  };

  return (
    <button 
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}
