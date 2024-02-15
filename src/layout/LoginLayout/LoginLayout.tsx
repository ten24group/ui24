import React, { ReactNode } from 'react';
import { Layout, Row, Col } from 'antd';
import "./LoginLayout.css";

const { Content } = Layout;

interface IChildren{
    children: ReactNode;
}

export const LoginLayout: React.FC<IChildren> = ( { children } ) => {

    return <Layout style={{ minHeight: '100vh' }}> {/* Ensures the Layout takes at least the full viewport height */}
      <div className="login-layout">
        <Row justify="center" align="middle" style={{ height: '100%', width: "50%" }}>
          <Col xs={24} sm={22} md={20} lg={16} xl={12}>
            {children}
          </Col>
        </Row>
        </div>
  </Layout>
}