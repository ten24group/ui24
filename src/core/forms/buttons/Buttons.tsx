import React from 'react';
import { Button, Checkbox, Form, Input, Space } from 'antd';
import { ButtonType } from 'antd/lib/button';
import { Link } from '../../common';

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
        className: "login-form-button mr-2",
        buttonType: "primary",
        htmlType: "submit"
    },
    "cancel" : {
        text: "Cancel",
        htmlType: "reset"
    },
    "reset" : {
        text: "Reset",
        danger: true,
        htmlType: "reset"
    }
  }

interface ICreateButtons {
    formButtons: Array< IPreDefinedButtons | IFormButton >
}

export const CreateButtons = ({ formButtons } : ICreateButtons ) => {
    const renderButton = (buttonConfig: IFormButton ) => {
        return <Form.Item>
                    <Button 
                        type = { buttonConfig?.buttonType } 
                        size = { buttonConfig.size ?? "middle" } 
                        href = { buttonConfig.href } 
                        onClick = { buttonConfig?.onClick } 
                        htmlType = { buttonConfig?.htmlType || "button" } 
                        className = { buttonConfig?.className || "mr-2" }
                        danger = { buttonConfig.danger }
                    >
                        { buttonConfig.url && <Link title={ buttonConfig.text} url={ buttonConfig.url } />} 
                        { !buttonConfig.url && buttonConfig.text } 
                    </Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            if( typeof buttonConfig === "string" ) {
                return <React.Fragment key={"bt" + index}>{ renderButton( PreDefinedButtons[ buttonConfig ] ) }</React.Fragment>
            } else {
                return <React.Fragment key={"bt" + index}>{ renderButton( buttonConfig ) }</React.Fragment>
            }
        })}
    </React.Fragment>
}

export type { ICreateButtons }