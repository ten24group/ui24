import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { IMaskingConfig, MaskingPattern } from '../types/field-config';
import type { Condition } from '../types/evaluation';
import { useCondition } from '../hooks/useCondition';

function applyBuiltinMask(value: string, pattern: MaskingPattern): string {
  switch (pattern) {
    case 'ssn':
      return value.length >= 4
        ? `***-**-${value.slice(-4)}`
        : '***-**-****';
    case 'email': {
      const atIdx = value.indexOf('@');
      if (atIdx <= 0) return '***@***';
      return `${value[0]}${'*'.repeat(Math.max(atIdx - 1, 2))}${value.slice(atIdx)}`;
    }
    case 'phone':
      return value.length >= 4
        ? `(***) ***-${value.slice(-4)}`
        : '(***) ***-****';
    case 'card':
      return value.length >= 4
        ? `**** **** **** ${value.slice(-4)}`
        : '**** **** **** ****';
    default:
      return '*'.repeat(Math.min(value.length, 12));
  }
}

function maskValue(value: string, config: IMaskingConfig): string {
  if (config.pattern === 'custom' && config.customPattern) {
    try {
      return value.replace(
        new RegExp(config.customPattern.match, 'g'),
        config.customPattern.replace
      );
    } catch {
      return '*'.repeat(Math.min(value.length, 12));
    }
  }
  return applyBuiltinMask(value, config.pattern);
}

interface MaskedDisplayProps {
  value: string;
  config: IMaskingConfig;
  fieldName?: string;
  onReveal?: (fieldName: string, timestamp: string) => void;
}

/**
 * Renders a masked value with optional reveal toggle (#51).
 * The reveal button is conditionally shown based on `revealCondition`.
 * When `revealDuration` is set, the value auto-hides after N seconds.
 */
export const MaskedDisplay: React.FC<MaskedDisplayProps> = ({ value, config, fieldName, onReveal }) => {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealAllowed = useCondition(
    config.allowReveal ? (config.revealCondition ?? true) : false
  );

  const toggle = useCallback(() => {
    setRevealed(prev => {
      const next = !prev;
      if (next) {
        if (config.revealDuration) {
          timerRef.current = setTimeout(() => setRevealed(false), config.revealDuration * 1000);
        }
        if (config.auditReveal && fieldName) {
          onReveal?.(fieldName, new Date().toISOString());
        }
      }
      return next;
    });
  }, [config.revealDuration, config.auditReveal, fieldName, onReveal]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!config.enabled) return <span>{value}</span>;

  const displayValue = revealed ? value : maskValue(value, config);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: revealed ? 'inherit' : 'monospace', letterSpacing: revealed ? 'normal' : '0.05em' }}>
        {displayValue}
      </span>
      {revealAllowed && (
        <Tooltip title={revealed ? 'Hide' : 'Reveal'}>
          <Button
            type="text"
            size="small"
            icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={toggle}
            style={{ padding: '0 4px', height: 'auto', lineHeight: 1 }}
          />
        </Tooltip>
      )}
    </span>
  );
};
