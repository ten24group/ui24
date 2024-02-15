export const apiResponse = ( alias : string ) => {

    const mockResponse = {
        '/login' : {
            'data' : {
                "pageType": "form",
                "propertiesConfig" : [
                    {
                        column: "emailAddress",
                        label : "Email Address",
                        placeholder: "",
                        validations: ["required", "email"]
                    }, {
                        column: "password",
                        label : "Password",
                        placeholder: "",
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
                        placeholder: "",
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
        },
        "/create-account" : {
            'data' : {
                "pageType": "form",
                "propertiesConfig" : [
                    {
                        column: "firstName",
                        label : "First Name",
                        validations: ["required"]
                    }, {
                        column: "lastName",
                        label : "Last Name",
                        validations: ["required"]
                    }, {
                        column: "emailAddress",
                        label : "Email Address",
                        validations: ["required", "email"]
                    },  {
                        column: "address",
                        label : "Address",
                        fieldType: "textarea",
                        validations: ["required"]
                    }
                ]
            }
        }
    }

    return mockResponse[ alias ].data.propertiesConfig
}