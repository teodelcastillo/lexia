/**
 * Sonner Toast Component
 * 
 * Styled wrapper for toast notifications.
 * Uses light theme by default for the professional legal application.
 */
'use client'

import React from "react"

import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toaster component providing toast notifications throughout the app
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
