import React from "react"
import { Result, Button } from "antd";
import { useAuth, useUi24Config } from "../../core/context";
import { PostAuthPage } from "../PostAuth/PostAuthPage";
import { useCoreNavigator } from "../../routes/Navigation";

/**
 * Forbidden (403) page — rendered when a user does not have permission to access a resource.
 * Reads customization from `config.errorPages.forbidden`.
 */
export const Forbidden = () => {
    const { isLoggedIn } = useAuth();
    const { config } = useUi24Config();
    const navigate = useCoreNavigator();
    const errorConfig = config.errorPages?.forbidden;

    const title = errorConfig?.title || "Access Denied";
    const message = errorConfig?.message || "You don't have permission to access this page.";
    const showHomeLink = errorConfig?.showHomeLink !== false; // default: true

    const content = (
        <Result
            status="403"
            title={title}
            subTitle={message}
            extra={showHomeLink ? (
                <Button type="primary" onClick={() => navigate('/')}>
                    Back Home
                </Button>
            ) : undefined}
        />
    );

    return isLoggedIn ? (
        <PostAuthPage pageTitle={title}>
            {content}
        </PostAuthPage>
    ) : content;
}
