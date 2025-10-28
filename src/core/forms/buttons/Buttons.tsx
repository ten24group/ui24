import React from 'react';
import { Button, Checkbox, Form, Input, Space } from 'antd';
import { ButtonType } from 'antd/lib/button';
import { Link } from '../../common';
import { substituteUrlParams } from '../../utils';

type IButtonType = ButtonType
type IHtmlType = "submit" | "reset" | "button"
interface IFormButton {
    buttonType?: IButtonType;
    htmlType?: IHtmlType;
    className?: string;
    text: string;
    style?: any;
    size?: any;
    href?: string;
    url?: string;
    danger?: boolean;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
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
        htmlType: "reset",
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

export const CreateButtons = ({ formButtons, loader = false, routeParams = {}, onCancelCallback } : ICreateButtons ) => {
    const renderButton = (buttonConfig: IFormButton = { text: "Unknown"}, loader: boolean = false, isCancelButton: boolean = false ) => {
        // Handle URL placeholder substitution
        let processedUrl = buttonConfig.url;
        if (processedUrl && Object.keys(routeParams).length > 0) {
            processedUrl = substituteUrlParams(processedUrl, routeParams);
        }

        // For cancel buttons with URL and modal context, call onCancelCallback instead of navigating
        // CRITICAL: Do NOT render Link component for cancel buttons in modals
        const shouldUseCallback = isCancelButton && processedUrl && onCancelCallback;
        
        const handleClick = (e: React.MouseEvent<HTMLElement>) => {
            if (shouldUseCallback) {
                e.preventDefault();  // Prevent any navigation
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
                    >
                        { processedUrl && !shouldUseCallback && <Link title={ buttonConfig.text} url={ processedUrl } />} 
                        { (!processedUrl || shouldUseCallback) && buttonConfig.text } 
                    </Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            if( typeof buttonConfig === "string" ) {
                const isCancelButton = buttonConfig === "cancel";
                return  <div key={"bt" + index} style={ {marginRight: "10px"}}>{ renderButton( PreDefinedButtons[ buttonConfig ], ( loader === true && buttonConfig !== "cancel" && buttonConfig !== "reset" ), isCancelButton ) }</div>
            } else {
                // Check if it's a custom cancel button (has "cancel" in text or className)
                const isCancelButton = buttonConfig.text?.toLowerCase().includes('cancel') || buttonConfig.className?.includes('cancel');
                return <div key={"bt" + index} style={ {marginRight: "10px"}}>{ renderButton( buttonConfig, false, isCancelButton ) }</div>
            }
        })}
    </React.Fragment>
}

export type { ICreateButtons }