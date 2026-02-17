import React from "react"
import { Result, Button } from "antd";
import { useAuth, useUi24Config } from "../../core/context";
import { PostAuthPage } from "../PostAuth/PostAuthPage";
import { useCoreNavigator } from "../../routes/Navigation";

export const NotFound = () => {
    const { isLoggedIn } = useAuth();
    const { config } = useUi24Config();
    const navigate = useCoreNavigator();
    const errorConfig = config.errorPages?.notFound;

    const title = errorConfig?.title || "Page Not Found";
    const message = errorConfig?.message || "The page you're looking for doesn't exist or has been moved.";
    const showHomeLink = errorConfig?.showHomeLink !== false;

    return isLoggedIn ? (
        <PostAuthPage pageTitle={title}>
            <Result
                status="404"
                title={title}
                subTitle={message}
                extra={showHomeLink ? (
                    <Button type="primary" onClick={() => navigate('/')}>
                        Back Home
                    </Button>
                ) : undefined}
            />
        </PostAuthPage>
    ) : (
        <Result
            status="404"
            title={title}
            subTitle={message}
            extra={showHomeLink ? (
                <Button type="primary" onClick={() => navigate('/')}>
                    Back Home
                </Button>
            ) : undefined}
        />
    );
}