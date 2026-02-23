import React, { useRef, useCallback } from 'react';
import { IMaskInput } from 'react-imask';

/**
 * Built-in format presets mapping format names to IMask configuration.
 */
const FORMAT_PRESETS: Record<string, { mask: string; definitions?: Record<string, RegExp>; lazy?: boolean }> = {
  phone: {
    mask: '(000) 000-0000',
    lazy: false,
  },
  ssn: {
    mask: '000-00-0000',
    lazy: false,
  },
  zip: {
    mask: '00000',
    lazy: false,
  },
  zipPlus4: {
    mask: '00000-0000',
    lazy: false,
  },
  creditCard: {
    mask: '0000 0000 0000 0000',
    lazy: false,
  },
  date: {
    mask: '00/00/0000',
    lazy: false,
  },
  ein: {
    mask: '00-0000000',
    lazy: false,
  },
};

/**
 * Number mask presets for currency and percentage.
 */
const NUMBER_FORMAT_PRESETS: Record<string, object> = {
  currency: {
    mask: Number,
    scale: 2,
    thousandsSeparator: ',',
    padFractionalZeros: true,
    normalizeZeros: true,
    radix: '.',
    mapToRadix: ['.'],
  },
  percentage: {
    mask: Number,
    scale: 2,
    min: 0,
    max: 100,
    radix: '.',
    mapToRadix: ['.'],
  },
};

interface MaskedInputProps {
  /** Raw mask pattern string (passed to IMask) */
  mask?: string;
  /** Named format preset ('phone', 'currency', 'percentage', 'ssn') */
  format?: string;
  /** Additional mask options */
  maskOptions?: {
    lazy?: boolean;
    placeholderChar?: string;
  };
  /** Current value (controlled) */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** HTML id */
  id?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Antd-styled masked input using IMask.
 * Supports both named format presets and custom mask patterns.
 */
export const MaskedInput: React.FC<MaskedInputProps> = ({
  mask,
  format,
  maskOptions,
  value,
  onChange,
  placeholder,
  id,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAccept = useCallback(
    (val: string) => {
      onChange?.(val);
    },
    [onChange]
  );

  // Resolve mask configuration from preset or custom mask
  let maskConfig: Record<string, unknown>;

  // Check number presets first
  if (format && NUMBER_FORMAT_PRESETS[format]) {
    maskConfig = { ...NUMBER_FORMAT_PRESETS[format] };
  }
  // Then string presets
  else if (format && FORMAT_PRESETS[format]) {
    const preset = FORMAT_PRESETS[format];
    maskConfig = {
      mask: preset.mask,
      definitions: preset.definitions,
      lazy: maskOptions?.lazy ?? preset.lazy ?? false,
    };
  }
  // Custom mask string
  else if (mask) {
    maskConfig = {
      mask,
      lazy: maskOptions?.lazy ?? false,
    };
  }
  // Fallback: no mask, render plain
  else {
    maskConfig = { mask: /.*/ };
  }

  if (maskOptions?.placeholderChar) {
    maskConfig.placeholderChar = maskOptions.placeholderChar;
  }

  return (
    <IMaskInput
      {...maskConfig}
      value={value ?? ''}
      onAccept={handleAccept}
      placeholder={placeholder}
      id={id}
      disabled={disabled}
      inputRef={inputRef}
      className={`ant-input masked-input${disabled ? ' masked-input--disabled' : ''}`}
    />
  );
};
