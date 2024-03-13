import React from 'react';
import { Button, Checkbox, Form, Input, Space } from 'antd';

type IButtonType = "primary" | "secondary"
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
        htmlType: "reset"
    }
  }

interface ICreateButtons {
    formButtons: Array< IPreDefinedButtons | IFormButton >
}

export const CreateButtons = ({ formButtons } : ICreateButtons ) => {
    const renderButton = (buttonConfig: IFormButton ) => {
        return <Form.Item>
                    <Button onClick={ buttonConfig?.onClick } href={ buttonConfig.href } size={ buttonConfig.size ?? "large" } style={ buttonConfig.style } type={ buttonConfig?.buttonType || "" } htmlType={ buttonConfig?.htmlType || "" } className={ buttonConfig?.className || ""}>{ buttonConfig.text }</Button>
                </Form.Item>
    }

    return <React.Fragment>
        { formButtons.map( (buttonConfig, index: number ) => {
            if( typeof buttonConfig === "string" ) {
                return  <React.Fragment key={"bt" + index}>{ renderButton( PreDefinedButtons[ buttonConfig ] ) }</React.Fragment>
            } else {
                return <React.Fragment key={"bt" + index}>{ renderButton( buttonConfig ) }</React.Fragment>
            }
        })}
    </React.Fragment>
}

export type { ICreateButtons }