import React, { ReactNode } from 'react';
import "./AuthLayout.css";
import { useUi24Config } from '../../core/context';

interface IPreAuthLayout {
    layoutConfig? : {
        title: string;
        description: string;
    }
    children: ReactNode;
}

export const AuthLayout: React.FC<IPreAuthLayout> = ( { layoutConfig = {
    title: "Admin Login",
    description: ""
}, children } ) => {
    const { selectConfig } = useUi24Config()
    const appLogo = selectConfig( config => config.appLogo)

    return <div className="login-layout">
        <div className="preAuthLoginContainer">
            <div className="containerTop">
                <div className="header">
                    { appLogo !== "" && <div className="logo"><img src={appLogo} alt="App Logo" title="Logo" /></div> }
                </div>
                <div className="title">{ layoutConfig.title } </div>
                
                <div className="description">{ layoutConfig.description }</div>
            </div>
            {children}
        </div>
      </div>
}