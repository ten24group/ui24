import React from 'react';
import { Modal as AntModal } from 'antd';
import { IForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/type';
import { Icon } from '../core/common';
import { Link } from '../core/common';
import { RenderFromPageType, IPageType } from '../pages/PostAuth/PostAuthPage';
import { useApi, IApiConfig } from '../core/context';
import { useAppContext } from '../core/context/AppContext';
import { IDetailsConfig } from '../detail/Details';

interface IConfirmModal {
  title: string;
  content: string;
}
type IModalType = "confirm" | "list" | "form" | "custom"| "details"

type IModalPageConfig = IConfirmModal | IForm | ITableConfig | IDetailsConfig;

export interface IModalConfig {
    modalType: IModalType;
    modalPageConfig?: IModalPageConfig;
    children?: React.ReactNode | React.ReactNode[];
    button?: React.ReactNode;
    apiConfig?: IApiConfig;
    primaryIndex?: string;
    useDynamicIdFromParams?: boolean;
    onSuccessCallback?: ( response?:any ) => void;
    onConfirmCallback?: () => void;
    onCancelCallback?: () => void;
    onOpenCallback?: () => void;
}

export const Modal = ({
    modalType,
    children,
    modalPageConfig,
    apiConfig,
    primaryIndex = "",
    useDynamicIdFromParams = true,
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
        onSuccessCallback && onSuccessCallback(response)
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
        ["list", "form", "details"].includes(modalType) && modalPageConfig ? //Dynamic Modal based on pageType
        <AntModal
            footer={ null }
            open={true}
            onCancel={ onCancelCallback }
          >
            <RenderFromPageType 
              cardStyle={{ marginTop: "5%"}} 
              pageType={ modalType as IPageType } 
              listPageConfig={ modalType === "list" ? modalPageConfig as ITableConfig : undefined } 
              formPageConfig={ modalType === "form" ? {...modalPageConfig, onSubmitSuccessCallback : onSuccessCallback, useDynamicIdFromParams: false } as IForm: undefined } 
              detailsPageConfig={ modalType === "details" ? modalPageConfig as IDetailsConfig : undefined}
            />
          </AntModal>
          : modalType === "custom" && children ? <AntModal footer={ null }
          open={true}
          onCancel={ onCancelCallback } >{ children } </AntModal> : null
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

  const onSuccessCallback = (response) => {
    setOpen(false)
    if( props.onSuccessCallback ) {
      props.onSuccessCallback(response)
    }
  }
  
  return <>
    <Link onClick={(url) => { 
      setOpen(true);
      if( props.onOpenCallback ) {
        props.onOpenCallback()
      }
      }} className="OpenInModal">
        { Array.isArray(props.children) ? props.children[0]: props.children }
    </Link>
    { open && <Modal {...props} onSuccessCallback={ onSuccessCallback } onConfirmCallback={ onConfirmCallback } onCancelCallback={onCancelCallback} children={ Array.isArray(props.children) ? props.children[1]: null } /> }
    </>
}