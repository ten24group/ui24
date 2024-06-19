import React from 'react';
import { Modal as AntModal } from 'antd';
import { IForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/type';
import { Icon } from '../core/common';
import { Link } from '../core/common';
import { RenderFromPageType, IPageType } from '../pages/PostAuth/PostAuthPage';
import { useApi, IApiConfig } from '../core/context';
import { useAppContext } from '../core/context/AppContext';

interface IConfirmModal {
  title: string;
  content: string;
}
type IModalType = "confirm" | "list" | "form"

type IModalPageConfig = IConfirmModal | IForm | ITableConfig

export interface IModalConfig {
    modalType: IModalType;
    modalPageConfig?: IModalPageConfig;
    children?: React.ReactNode | React.ReactNode[];
    button?: React.ReactNode;
    apiConfig?: IApiConfig;
    primaryIndex: string;
    onSuccessCallback?: () => void;
    onConfirmCallback?: () => void;
    onCancelCallback?: () => void;
}

export const Modal = ({
    modalType,
    children,
    modalPageConfig,
    apiConfig,
    primaryIndex = "",
    onSuccessCallback,
    button,
    onCancelCallback,
    onConfirmCallback
} : IModalConfig ) => {
    
    const { notifyError } = useAppContext()
    const { callApiMethod } = useApi();

    const confirmApiAction = async () => {
      const formattedApiUrl = primaryIndex !== "" ? apiConfig.apiUrl + `/${primaryIndex}` : apiConfig.apiUrl
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl: formattedApiUrl
      });
      
      if( response.status === 200 ) {
        onSuccessCallback && onSuccessCallback()
      } else if( response.status === 400 || response.status === 500 ) {
        notifyError(response?.error)
      }

      onConfirmCallback && onConfirmCallback()
    }

    return <>
    { modalType === "confirm" && modalPageConfig && 'title' in modalPageConfig ? //confirm Moda
        (<AntModal
            title={ modalPageConfig?.title }
            open={true}
            onOk={ confirmApiAction }
            onCancel={ onCancelCallback }
            okText="Confirm"
            cancelText="Cancel"
          >
            {modalPageConfig?.content}
            {children}
            
          </AntModal>) :
        ["list", "form"].includes(modalType) && modalPageConfig ? //Dynamic Modal based on pageType
        <AntModal
            footer={ null }
            open={true}
            onCancel={ onCancelCallback }
          >
            <RenderFromPageType 
              cardStyle={{ marginTop: "5%"}} 
              pageType={ modalType as IPageType } 
              listPageConfig={ modalType === "list" ? modalPageConfig as ITableConfig : undefined } 
              formPageConfig={ modalType === "form" ? modalPageConfig as IForm: undefined } 
            />
          </AntModal>
          : null //fallback to null
      }
      </>
}

type IOpenInModal = IModalConfig

export const OpenInModal = ({...props }: IOpenInModal ) => {
  
  const [open, setOpen] = React.useState(false)

  const onCancelCallback = () => {
    setOpen(false)
    if( props.onCancelCallback ) {
      props.onCancelCallback()
    }
  }

  const onConfirmCallback = () => {
    setOpen(false)
    if( props.onConfirmCallback ) {
      props.onConfirmCallback()
    }
  }
  
  return <>
    <Link onClick={(url) => { setOpen(true); }} className="OpenInModal">
        { props.children }
    </Link>
    { open && <Modal {...props} onConfirmCallback={ onConfirmCallback } onCancelCallback={onCancelCallback} children={ Array.isArray(props.children) ? props.children[1]: null } /> }
    </>
}