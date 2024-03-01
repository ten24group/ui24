import React, { createContext } from 'react';
import { Button, Modal as AntModal, Space, notification } from 'antd';
import { ICustomForm } from '../core/forms/formConfig';
import { ITableConfig } from '../table/Table';
import { Icon } from '../core/common';
import { Link } from '../core/common';
import { RenderFromPageType } from '../pages/PostAuth/PostAuthPage';
import { ExclamationCircleOutlined } from '@ant-design/icons';
interface IConfirmModal {
  title: string;
  content: string;
}
type IModalPageConfig = IConfirmModal | ICustomForm | ITableConfig;
type IModalType = "confirm" | "list" | "form"
export interface IModalConfig {
    modalType: IModalType;
    modalPageConfig?: IModalPageConfig;
    children?: React.ReactNode;
    button?: React.ReactNode;
}

export const Modal = ({
    modalType,
    children,
    modalPageConfig,
    button
} : IModalConfig ) => {
    const [open, setOpen] = React.useState(false)
    const [ api, contextHolder ] = notification.useNotification();

    return <>
    { contextHolder }
    <Link onClick={(url) => {
      setOpen(true)}
      } ><Icon iconName={"delete"} /></Link>
    { modalType === "confirm" && modalPageConfig && 'title' in modalPageConfig && 
    <AntModal
        title={ modalPageConfig?.title }
        open={open}
        onOk={()=> {
          api.success({ message: "Deleted Successfully", duration: 2 })
          console.log( "Deleted Successfully" )
          setOpen(false)
        }}
        onCancel={()=> setOpen(false)}
        okText="Confirm"
        cancelText="Cancel"
      >
        {modalPageConfig?.content}
        {children}
        
      </AntModal>
      }
      { open && ( modalType === "list" || modalType === "form" ) && modalPageConfig &&
      <AntModal
      footer={ null }
      open={open}
      onCancel={()=> setOpen(false)}
    >
        <RenderFromPageType cardStyle={{ marginTop: "5%"}} pageType={ modalType } listPageConfig={ modalPageConfig } formPageConfig={ modalPageConfig } />
        </AntModal>
      }
      </>
}


{/* Let's document an idea I'm thinking about to have a commong config for buttons which can be use accross the admin panel */}
type ITitleOrIconOnly = { title: string; iconOnly?: boolean; } | { title?: string; iconOnly: boolean; }

type IButtonAction = "redirect" | "model" | "api"
type IButtonConfig = ITitleOrIconOnly & {
  icon: string;
  children: React.ReactNode;
  url: string;
  action: IButtonAction
}

type IHeaderButtonsConfig = Array<IButtonConfig>
type IPageHaderButtonsConfig = Array<IButtonConfig>

type ITableRecordButtonsConfig = Array<{
  addDataIndexToUrl?: boolean;
}>