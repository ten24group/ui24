import React from 'react';
import { Modal as AntModal } from 'antd';
import { ICustomForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/type';
import { Icon } from '../core/common';
import { Link } from '../core/common';
import { IPageType, RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { IApiConfig } from '../core';
import { callApiMethod } from '../core';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../core/context/AppContext';

interface IConfirmModal {
  title: string;
  content: string;
}
type IModalType = "confirm" | "list" | "form"

type IModalPageConfig = IConfirmModal | ICustomForm | ITableConfig

export interface IModalConfig {
    modalType: IModalType;
    modalPageConfig?: IModalPageConfig;
    children?: React.ReactNode;
    button?: React.ReactNode;
    apiConfig?: IApiConfig;
    primaryIndex: string;
    onSuccessCallback?: () => void;
}

export const Modal = ({
    modalType,
    children,
    modalPageConfig,
    apiConfig,
    primaryIndex = "",
    onSuccessCallback,
    button
} : IModalConfig ) => {
    const [open, setOpen] = React.useState(false)
    const { notifyError, notifySuccess } = useAppContext()

    const deleteApiAction = async () => {
      const formattedApiUrl = primaryIndex !== "" ? apiConfig.apiUrl + `/${primaryIndex}` : apiConfig.apiUrl
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl: formattedApiUrl
      });
      
      if( response.status === 200 ) {
        notifySuccess("Deleted Successfully")

        onSuccessCallback && onSuccessCallback()

      } else if( response.status === 400 || response.status === 500 ) {
        notifyError(response?.error)
      }
      
      setOpen(false)
    }

    return <>
    <Link onClick={(url) => { setOpen(true)}}>
        <Icon iconName={"delete"} />
    </Link>
    
    { modalType === "confirm" && modalPageConfig && 'title' in modalPageConfig && 
        <AntModal
            title={ modalPageConfig?.title }
            open={open}
            onOk={ deleteApiAction }
            onCancel={()=> setOpen(false)}
            okText="Confirm"
            cancelText="Cancel"
          >
            {modalPageConfig?.content}
            {children}
            
          </AntModal>
      }
      
      { open && ["list", "form"].includes(modalType) && modalPageConfig &&
          <AntModal
            footer={ null }
            open={open}
            onCancel={()=> setOpen(false)}
          >
            <RenderFromPageType 
              cardStyle={{ marginTop: "5%"}} 
              pageType={ modalType as IPageType } 
              listPageConfig={ modalType === "list" ? modalPageConfig as ITableConfig : undefined } 
              formPageConfig={ modalType === "form" ? modalPageConfig as ICustomForm: undefined } 
            />
          </AntModal>
      }
      </>
}