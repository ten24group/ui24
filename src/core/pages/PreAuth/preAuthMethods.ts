import { usePageConfig } from "../../forms";
import { IFormConfig } from "../../forms/formConfig";

export const preAuthMethods = () => {
    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };

    const { propertiesConfig } = usePageConfig("/login");

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