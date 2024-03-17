export const mockApiResponse = ( alias : string ) => {

    const mockResponse = {
        '/login' : {
            "apiConfig" : {
                "apiUrl" : "/login",
                "apiMethod" : "POST"
            },
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
                        fieldType: "password",
                        placeholder: "Password",
                        validations: ["required"]
                    }
                ]
            }
        },
        '/forgot-password' : {
            "apiConfig" : {
                "apiUrl" : "/forgot-password",
                "apiMethod" : "POST"
            },
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
            },
            "apiConfig" : {
                "apiUrl" : "/reset-password",
                "apiMethod" : "POST"
            },
        }
    }

    return {
        pageType : mockResponse[ alias ]?.data?.pageType,
        apiConfig: mockResponse[ alias ]?.apiConfig,
        propertiesConfig: mockResponse[ alias ]?.data?.propertiesConfig,
        data: mockResponse[ alias ]?.data
    }
}