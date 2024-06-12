import React from 'react';
import { Button, Checkbox, Form, Input, Space } from 'antd';
import { ButtonType } from 'antd/lib/button';

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
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

type IPreDefinedButtons = "submit" | "cancel" | "login" | "forgotPassword";

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
        style: { marginLeft: "10%" }
    }
  }

interface ICreateButtons {
    formButtons: Array< IPreDefinedButtons | IFormButton >
    loader?: boolean
}

export const CreateButtons = ({ formButtons, loader = false } : ICreateButtons ) => {
    const renderButton = (buttonConfig: IFormButton, loader: boolean = false ) => {
        return <Form.Item>
                    <Button 
                        type = { buttonConfig?.buttonType || "primary" } 
                        size = { buttonConfig.size ?? "large" } 
                        href = { buttonConfig.href } 
                        style = { buttonConfig.style } 
                        onClick = { buttonConfig?.onClick } 
                        htmlType = { buttonConfig?.htmlType || "button" } 
                        className = { buttonConfig?.className || "" }
                        loading = { loader }
                    > 
                        { buttonConfig.text } 
                    </Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            if( typeof buttonConfig === "string" ) {
                return  <React.Fragment key={"bt" + index}>{ renderButton( PreDefinedButtons[ buttonConfig ], ( loader === true && buttonConfig !== "cancel" ) ) }</React.Fragment>
            } else {
                return <React.Fragment key={"bt" + index}>{ renderButton( buttonConfig ) }</React.Fragment>
            }
        })}
    </React.Fragment>
}

export type { ICreateButtons }