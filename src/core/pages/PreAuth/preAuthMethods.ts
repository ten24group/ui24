import { useNavigate } from "react-router-dom";
import { postMethod } from "../../api/apiMethods";
import { usePageConfig } from "../../forms";
import { IFormConfig } from "../../forms/formConfig";


export const preAuthMethods = () => {
    const onFinish = async (values: any) => {
        console.log('Received values of form: ', values);
        const response = await postMethod('/auth/signin', {
            "email": values.email,
            "password": values.password,
        });

        console.log(" login response", response);

    };

    // TODO: const { propertiesConfig } = usePageConfig("/user/login");
    const propertiesConfig = [
        {
            name: "email",
            column: "email",
            label : "Email Address",
            placeholder: "Email Address",
            validations: ["required", "email"]
        }, {
            name: "password",
            fieldType: 'password',
            column: "password",
            label : "Password",
            placeholder: "Password",
            validations: ["required"]
        }
    ];

    const formConfig : IFormConfig = {
        name: "loginForm",
        className: "login-form"
    }

    return {
        onFinish,
        propertiesConfig,
        formConfig
    }
}