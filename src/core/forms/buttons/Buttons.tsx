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
}

export const CreateButtons = ({ formButtons, loader = false, routeParams = {} } : ICreateButtons ) => {
    const renderButton = (buttonConfig: IFormButton = { text: "Unknown"}, loader: boolean = false ) => {
        // Handle URL placeholder substitution
        let processedUrl = buttonConfig.url;
        if (processedUrl && Object.keys(routeParams).length > 0) {
            processedUrl = substituteUrlParams(processedUrl, routeParams);
        }

        return <Form.Item>
                    <Button 
                        type = { buttonConfig?.buttonType } 
                        size = { buttonConfig.size ?? "middle" } 
                        href = { buttonConfig.href } 
                        onClick = { buttonConfig?.onClick } 
                        htmlType = { buttonConfig?.htmlType || "button" } 
                        className = { buttonConfig?.className }
                        danger = { buttonConfig.danger }
                        loading = { loader }
                    >
                        { processedUrl && <Link title={ buttonConfig.text} url={ processedUrl } />} 
                        { !processedUrl && buttonConfig.text } 
                    </Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            if( typeof buttonConfig === "string" ) {
                return  <div key={"bt" + index} style={ {marginRight: "10px"}}>{ renderButton( PreDefinedButtons[ buttonConfig ], ( loader === true && buttonConfig !== "cancel" && buttonConfig !== "reset" ) ) }</div>
            } else {
                return <div key={"bt" + index} style={ {marginRight: "10px"}}>{ renderButton( buttonConfig ) }</div>
            }
        })}
    </React.Fragment>
}

export type { ICreateButtons }