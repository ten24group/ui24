import React from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { PreAuthLayout } from '../../layout';
import { useParams } from "react-router-dom"
import { useAuth } from '../../core';
import { UI24Config } from '../../core';
import { AppNavigator } from '../../routes/AppRouter';
import { NotFound } from '../404/NotFound';

export const DynamicPage = () => {
    //get routes from URL
    const { dynamicPage = "", dynamicID = ""} = useParams()
    
    const { isLoggedIn } = useAuth();

    let pageConfig = dynamicPage === 'dashboard' ? UI24Config.uiConfig.dashboard : UI24Config.uiConfig.pages[dynamicPage]

    //check if page config exists for the route
    if( !pageConfig ){
        //TODO: Fallback : make API call to get page config
    }

    if( !pageConfig ){
        return <NotFound />
    }

    if( !isLoggedIn && pageConfig?.private === true ){
        return <AppNavigator />
    }

    return ( pageConfig?.private === true || ( pageConfig?.private ?? true ) ) ? <PostAuthPage {...pageConfig} /> : <PreAuthLayout>
        <h3>Define your page.</h3>
    </PreAuthLayout>;
}