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
import { substituteUrlParams } from '../core/utils';
import { useNavigate } from 'react-router-dom';
import { IAccordionPageConfig } from '../pages/PostAuth/Accordion/Accordion';
import { IDashboardPageConfig } from '../pages/PostAuth/DashboardPage';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';

interface IConfirmModal {
  title: string;
  content?: string;
}
type IModalType = "confirm" | "list" | "form" | "custom" | "details" | "accordion" | "dashboard";

type IModalPageConfig = IConfirmModal | IForm | ITableConfig | IDetailsConfig | IAccordionPageConfig | IDashboardPageConfig;

export interface IModalConfig {
  modalType: IModalType;
  modalPageConfig?: IModalPageConfig;
  children?: React.ReactNode | React.ReactNode[];
  button?: React.ReactNode;
  apiConfig?: IApiConfig;
  primaryIndex?: string;
  useDynamicIdFromParams?: boolean;
  onSuccessCallback?: (response?: any) => void;
  onConfirmCallback?: () => void;
  onCancelCallback?: () => void;
  onOpenCallback?: () => void;
  submitSuccessRedirect?: string;
  routeParams?: Record<string, string>;
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
  onConfirmCallback,
  submitSuccessRedirect,
  routeParams = {}
}: IModalConfig) => {

  const { notifyError, notifySuccess } = useAppContext()
  const { callApiMethod } = useApi();
  const navigate = useNavigate();
  const [ loading, setLoading ] = React.useState(false);

  const confirmApiAction = async () => {
    // Use the clean utility function for URL parameter substitution
    const formattedApiUrl = substituteUrlParams(apiConfig.apiUrl, routeParams, primaryIndex);
    setLoading(true);
    try {
      const response: any = await callApiMethod({
        ...apiConfig,
        apiUrl: formattedApiUrl
      });

      if (response.status === 200) {
        const responseData = apiConfig.responseKey ? response.data[ apiConfig.responseKey ] : response.data;
        const message = response.data?.details?.message || response.data?.message || response.message || "Operation Success";
        notifySuccess(message);

        onSuccessCallback && onSuccessCallback(responseData);
        if (submitSuccessRedirect) {
          // redirect to appropriate page
          // replace placeholders with the actual values
          let formattedSubmitSuccessRedirect = substituteUrlParams(submitSuccessRedirect, { ...routeParams, ...(responseData || {}) }, primaryIndex);
          navigate(formattedSubmitSuccessRedirect)
        }
      } else {
        const message = response.data?.details?.message || response.data?.message || response.message || "Operation Failed";
        notifyError(message)
      }

      onConfirmCallback && onConfirmCallback()
    } catch (error: any) {
      notifyError(error?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (modalType === "confirm" && modalPageConfig && 'title' in modalPageConfig) {
    return (
      <AntModal
        title={(modalPageConfig as IConfirmModal)?.title}
        open={true}
        onOk={confirmApiAction}
        onCancel={onCancelCallback}
        okText="Confirm"
        cancelText="Cancel"
        loading={loading}
      >
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            console.log("Modal (Confirm) ErrorBoundary Reset");
            onCancelCallback && onCancelCallback(); // Close modal on error reset
          }}
        >
          {(modalPageConfig as IConfirmModal)?.content}
          {children}
        </ErrorBoundary>
      </AntModal>
    )
  }

  if ([ "list", "form", "details", "accordion", "dashboard", "custom" ].includes(modalType) && modalPageConfig) {
    return (
      <AntModal
        footer={null}
        open={true}
        onCancel={onCancelCallback}
      >
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            console.log("Modal (PageType) ErrorBoundary Reset");
            onCancelCallback && onCancelCallback(); // Close modal on error reset
          }}
        >
          <RenderFromPageType
            cardStyle={{ marginTop: "5%" }}
            pageType={modalType as IPageType}
            listPageConfig={modalType === "list" ? modalPageConfig as ITableConfig : undefined}
            formPageConfig={
              modalType === "form" ? {
                ...modalPageConfig,
                onSubmitSuccessCallback: onSuccessCallback,
                useDynamicIdFromParams: false,
                routeParams
              } as IForm : undefined
            }
            detailsPageConfig={
              modalType === "details" ? modalPageConfig as IDetailsConfig : undefined
            }
            accordionsPageConfig={
              modalType === "accordion" ? modalPageConfig as IAccordionPageConfig : undefined
            }
            dashboardPageConfig={
              modalType === "dashboard" ? modalPageConfig as IDashboardPageConfig : undefined
            }
            routeParams={routeParams}
          />
        </ErrorBoundary>
      </AntModal>
    )
  }

  if (modalType === "custom" && children) {
    return (
      <AntModal
        footer={null}
        open={true}
        onCancel={onCancelCallback}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => {
            console.log("Modal (Custom) ErrorBoundary Reset");
            onCancelCallback && onCancelCallback(); // Close modal on error reset
          }}
        >
          {children}
        </ErrorBoundary>
      </AntModal>
    )
  }

  return <>Invalid Modal config { }</>
}

type IOpenInModal = IModalConfig

export const OpenInModal = ({ ...props }: IOpenInModal) => {

  const [ open, setOpen ] = React.useState(false)

  const onCancelCallback = () => {
    setOpen(false)
    if (props.onCancelCallback) {
      props.onCancelCallback()
    }
  }

  const onConfirmCallback = () => {
    setOpen(false)
    if (props.onConfirmCallback) {
      props.onConfirmCallback()
    }
  }

  const onSuccessCallback = (response) => {
    setOpen(false)
    if (props.onSuccessCallback) {
      props.onSuccessCallback(response)
    }
  }

  return <>
    <Link
      onClick={(url) => {
        setOpen(true);
        if (props.onOpenCallback) {
          props.onOpenCallback()
        }
      }}
      className="OpenInModal">
      {Array.isArray(props.children) ? props.children[ 0 ] : props.children}
    </Link>

    {open &&
      <Modal
        {...props}
        onSuccessCallback={onSuccessCallback}
        onConfirmCallback={onConfirmCallback}
        onCancelCallback={onCancelCallback}
        children={Array.isArray(props.children) ? props.children[ 1 ] : null}
      />
    }
  </>
}