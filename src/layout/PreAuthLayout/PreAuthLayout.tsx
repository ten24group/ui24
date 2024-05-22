import React, { ReactNode } from 'react';
import "./PreAuthLayout.css";
import { UI24Config } from '../../core';
import { CoreLayout } from '../CoreLayout';
import { useAuth } from '../../core';
import { AppNavigator } from '../../routes/AppRouter';

interface IPreAuthLayout {
    layoutConfig? : {
        title: string;
        description: string;
    }
    children: ReactNode;
}

export const PreAuthLayout: React.FC<IPreAuthLayout> = ( { layoutConfig = {
    title: "Admin Login",
    description: "Restricted area."
}, children } ) => {
    const { isLoggedIn } = useAuth();

    
    if( isLoggedIn ) {
        return <AppNavigator />
    }
    

    return <CoreLayout>
      <div className="login-layout">
        <div className="preAuthLoginContainer">
            <div className="containerTop">
                <div className="header">
                    { UI24Config?.appLogo !== "" && <div className="logo"><img src={UI24Config.appLogo} alt="App Logo" title="Logo" /></div> }
                </div>
                <div className="title">{ layoutConfig.title } </div>
                
                <div className="description">{ layoutConfig.description }</div>
            </div>
            {children}
        </div>
      </div>
  </CoreLayout>
}