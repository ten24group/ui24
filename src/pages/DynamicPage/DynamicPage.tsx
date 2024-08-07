import React from 'react';
import { PostAuthPage } from '../PostAuth/PostAuthPage';
import { useParams } from "react-router-dom"
import { NotFound } from '../404/NotFound';
import { useUi24Config } from '../../core/context';
import { OpenInModal } from '../../modal/Modal';
import { Icon } from '../../core/common';

export const DynamicPage = () => {
    //get routes from URL
    const { dynamicPage = "", dynamicID = ""} = useParams()
    const { getPageConfig, selectConfig, updateConfig } = useUi24Config()
    const pagesConfig = selectConfig( (config) => config.pagesConfig )
    const pageConfig = getPageConfig( dynamicPage )
    const pageNotFound = pagesConfig && Object.keys(pagesConfig).length > 0 && !pageConfig

    //check if page config exists for the route
    if( pageNotFound ){
        //TODO: Fallback : make API call to get page config
        console.error("Page config not found")
    }

    if( pageNotFound ){
        return <NotFound />
    }

    

    return ( pageConfig?.private === true || ( pageConfig?.private ?? true ) ) ? 
    <>
    <PostAuthPage {...pageConfig} />
    </>
    
     :  <h3>Define your page.</h3>
}