import React from 'react';
import { Button, Checkbox, Form, Input, Space } from 'antd';
type IButtonType = "primary" | "secondary"
type IHtmlType = "submit" | "reset"
interface IFormButton {
    buttonType?: IButtonType;
    htmlType?: IHtmlType;
    className?: string;
    text: string;
}

type IPreDefinedButtons = "submit" | "cancel" | "login";

const PreDefinedButtons: Record<IPreDefinedButtons, IFormButton> = {
    "login" : {
        text: "Log In",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit"
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
                <Button type={ buttonConfig?.buttonType || "" } htmlType={ buttonConfig?.htmlType || "" } className={ buttonConfig?.className || ""}>{ buttonConfig.text }</Button>
              </Form.Item>
    }

    return <React.Fragment>
        <Space>
        { formButtons.map( (buttonConfig, index ) => {
            if( typeof buttonConfig === "string" ) {
                return renderButton( PreDefinedButtons[ buttonConfig ] )
            } else {
                return renderButton( buttonConfig )
            }
        })}
        </Space>
    </React.Fragment>
}

export type { ICreateButtons }