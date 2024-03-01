export const apiResponse = ( alias : string ) => {

    const mockResponse = {
        '/login' : {
            'data' : {
                "pageType": "form",
                "propertiesConfig" : [
                    {
                        column: "emailAddress",
                        label : "Email Address",
                        placeholder: "Email Address",
                        validations: ["required", "email"]
                    }, {
                        column: "password",
                        label : "Password",
                        placeholder: "Password",
                        validations: ["required"]
                    }
                ]
            }
        },
        '/forgot-password' : {
            'data' : {
                "pageType": "form",
                "propertiesConfig" : [
                    {
                        column: "emailAddress",
                        label : "Email Address",
                        placeholder: "Email Address",
                        validations: ["required", "email"]
                    }
                ]
            }
        },
        '/reset-password' : {
            'data' : {
                "pageType": "form",
                "propertiesConfig" : [
                    {
                        column: "password",
                        label : "Password",
                        placeholder: "",
                        validations: ["required"]
                    }, {
                        column: "confirmPassword",
                        label : "Confirm Password",
                        placeholder: "",
                        validations: ["required", "match:password"]
                    }
                ]
            }
        }
    }

    return {
        pageType : mockResponse[ alias ]?.data?.pageType,
        propertiesConfig: mockResponse[ alias ]?.data?.propertiesConfig,
        data: mockResponse[ alias ]?.data
    }
}