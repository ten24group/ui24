import { Button, Form, Tooltip } from 'antd';
import type { ButtonSize, ButtonType } from 'antd/lib/button';
import type { CSSProperties } from 'react';
import React from 'react';
import { Link } from '../../common';
import { useEvaluation } from '../../hooks';
import { VisibilityConfig } from '../../types';
import { substituteUrlParams } from '../../utils';

type IButtonType = ButtonType
type IHtmlType = "submit" | "reset" | "button"

/**
 * Hook to debounce form values for evaluation
 * FIXED: Prevents evaluation on every keystroke
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
    
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    
    return debouncedValue;
}

interface IFormButton {
    buttonType?: IButtonType;
    htmlType?: IHtmlType;
    className?: string;
    text: string;
    style?: CSSProperties;
    size?: ButtonSize;
    href?: string;
    url?: string;
    danger?: boolean;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    /**
     * Visibility configuration for conditional rendering.
     * Evaluated with form values context for dynamic button behavior.
     */
    visibility?: VisibilityConfig;
}

type IPreDefinedButtons = "submit" | "cancel" | "reset" | "login" | "forgotPassword";

const PreDefinedButtons: Record<IPreDefinedButtons, IFormButton> = {
    "login" : {
        text: "Log In",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit",
        style: { width: "100%"},
        size: "large"
    }, 
    "forgotPassword" : {
        text: "Submit",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit",
        style: { width: "100%"},
        size: "large"
    }, 
    "submit" : {
        text: "Submit",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit"
    },
    "cancel" : {
        text: "Cancel",
        htmlType: "button",
    },
    "reset" : {
        text: "Reset",
        danger: true,
        htmlType: "reset",
    }
  }

interface ICreateButtons {
    formButtons: Array< IPreDefinedButtons | IFormButton >
    loader?: boolean
    routeParams?: Record<string, string>
    onCancelCallback?: () => void  // For modal cancel/close
}

export const CreateButtons = React.memo(({ formButtons, loader = false, routeParams = {}, onCancelCallback } : ICreateButtons ) => {
    
    const renderButton = (
        buttonConfig: IFormButton = { text: "Unknown"},
        loader: boolean = false,
        isCancelButton: boolean = false,
        isDisabled: boolean = false,
        disabledMessage?: string
    ) => {
        // Handle URL placeholder substitution
        let processedUrl = buttonConfig.url;
        if (processedUrl && Object.keys(routeParams).length > 0) {
            processedUrl = substituteUrlParams(processedUrl, routeParams);
        }

        // For cancel buttons in modal context, call onCancelCallback instead of navigating/resetting
        // CRITICAL: Do NOT render Link component for cancel buttons in modals
        const shouldUseCallback = isCancelButton && onCancelCallback;
        
        const handleClick = (e: React.MouseEvent<HTMLElement>) => {
            if (shouldUseCallback) {
                e.preventDefault();  // Prevent any navigation/reset
                e.stopPropagation(); // Stop event bubbling
                onCancelCallback();  // Close modal instead
            } else if (buttonConfig.onClick) {
                buttonConfig.onClick(e);
            }
        };

        return <Form.Item>
                    <Button 
                        type = { buttonConfig?.buttonType } 
                        size = { buttonConfig.size ?? "middle" } 
                        href = { buttonConfig.href } 
                        onClick = { handleClick } 
                        htmlType = { buttonConfig?.htmlType || "button" } 
                        className = { buttonConfig?.className }
                        danger = { buttonConfig.danger }
                        loading = { loader }
                        disabled = { isDisabled }
                    >
                        { processedUrl && !shouldUseCallback && <Link title={ buttonConfig.text} url={ processedUrl } />} 
                        { (!processedUrl || shouldUseCallback) && buttonConfig.text } 
                    </Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            // Handle string shortcuts (e.g., "submit", "reset", "cancel")
            if( typeof buttonConfig === "string" ) {
                const isCancelButton = buttonConfig === "cancel";
                const config = PreDefinedButtons[ buttonConfig ];
                return  <div key={"bt" + index} style={ {marginRight: "10px"}}>
                    <EvaluatedFormButton 
                        buttonConfig={config}
                        loader={loader === true && buttonConfig !== "cancel" && buttonConfig !== "reset"}
                        isCancelButton={isCancelButton}
                        renderButton={renderButton}
                    />
                </div>
            } else {
                // Handle button objects
                // Check if button has 'action' field matching a predefined button
                const action = (buttonConfig as any).action as IPreDefinedButtons | undefined;
                const isCancelButton = action === 'cancel' || buttonConfig.text?.toLowerCase().includes('cancel') || buttonConfig.className?.includes('cancel');
                
                // If action matches a predefined button, merge with predefined config
                const finalConfig = action && PreDefinedButtons[action]
                    ? { ...PreDefinedButtons[action], ...buttonConfig }  // Predefined defaults + custom overrides
                    : buttonConfig;  // Fully custom button
                
                return <div key={"bt" + index} style={ {marginRight: "10px"}}>
                    <EvaluatedFormButton 
                        buttonConfig={finalConfig}
                        loader={action === 'submit' && loader}  // Only show loader on submit
                        isCancelButton={isCancelButton}
                        renderButton={renderButton}
                    />
                </div>
            }
        })}
    </React.Fragment>
});

/**
 * Form button with evaluation support
 * Wrapped in separate component to properly use hooks
 */
const EvaluatedFormButton = React.memo(({
    buttonConfig,
    loader,
    isCancelButton,
    renderButton
}: {
    buttonConfig: IFormButton;
    loader: boolean;
    isCancelButton: boolean;
    renderButton: (config: IFormButton, loader: boolean, isCancelButton: boolean, isDisabled: boolean, disabledMessage?: string) => React.ReactNode;
}) => {
    const form = Form.useFormInstance();
    const rawFormValues = Form.useWatch([], form) || {};
    
    // FIXED: Debounce form values to avoid evaluation on every keystroke
    const formValues = useDebounce(rawFormValues, 300);
    
    // Evaluate visibility
    const { visible, enabled, disabledMessage } = useEvaluation(buttonConfig.visibility, { formValues });
    
    // Don't render if not visible
    if (!visible) return null;
    
    const isDisabled = !enabled;
    
    // Wrap with tooltip if disabled
    if (isDisabled && disabledMessage) {
        return (
            <Tooltip title={disabledMessage}>
                <span>
                    {renderButton(buttonConfig, loader, isCancelButton, true, disabledMessage)}
                </span>
            </Tooltip>
        );
    }
    
    return <>{renderButton(buttonConfig, loader, isCancelButton, false)}</>;
});

export type { ICreateButtons };
