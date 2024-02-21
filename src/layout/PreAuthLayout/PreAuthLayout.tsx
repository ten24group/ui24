import React, { ReactNode } from 'react';
import { Layout, Row, Col } from 'antd';
import "./PreAuthLayout.css";
import { FW24Config } from '../../core';

const { Content } = Layout;

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

    return <Layout style={{ minHeight: '100vh' }}>
      <div className="login-layout">
        <div className="preAuthLoginContainer">
            <div className="containerTop">
                <div className="header">
                    { FW24Config?.appLogo !== "" && <div className="logo"><img src={FW24Config.appLogo} alt="App Logo" title="Logo" /></div> }
                </div>
                <div className="title">{ layoutConfig.title } </div>
                
                <div className="description">{ layoutConfig.description }</div>
            </div>
            {children}
        </div>
      </div>
  </Layout>
}