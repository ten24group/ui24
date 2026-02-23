import { Button, Form, Tooltip } from 'antd';
import type { ButtonSize, ButtonType } from 'antd/lib/button';
import type { CSSProperties } from 'react';
import React from 'react';
import { Link } from '../../common';
import { useNewEvaluationContext } from '../../context/NewEvaluationContext';
import { useCondition } from '../../hooks/useCondition';
import { Condition } from '../../types';
import { resolveDisabledMessage as resolveMsg } from '../../utils/resolveDisabledMessage';
import { substituteUrlParams } from '../../utils';

type IButtonType = ButtonType
type IHtmlType = "submit" | "reset" | "button"

interface IFormButton {
    buttonType?: IButtonType;
    htmlType?: IHtmlType;
    className?: string;
    text: string;
    style?: CSSProperties;
    size?: ButtonSize;
    href?: string;
    url?: string;
    danger?: boolean;
    /** Action identifier — set by Form.tsx effectiveFormButtons (e.g. 'submit', 'cancel') */
    action?: string;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    /**
     * Visibility condition for conditional rendering.
     * Evaluated with form context for dynamic button behavior.
     * Uses the new Condition system (named refs, feature flags, device, etc.).
     */
    visibility?: Condition;
    /**
     * Enablement condition — evaluated separately from visibility.
     * When false, the button renders as disabled.
     */
    enablement?: Condition;
    /** Message to show in a tooltip when the button is disabled by enablement condition */
    disabledMessage?: string;
}

type IPreDefinedButtons = "submit" | "cancel" | "reset" | "login" | "forgotPassword";

const PreDefinedButtons: Record<IPreDefinedButtons, IFormButton> = {
    "login": {
        text: "Log In",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit",
        style: { width: "100%" },
        size: "large"
    },
    "forgotPassword": {
        text: "Submit",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit",
        style: { width: "100%" },
        size: "large"
    },
    "submit": {
        text: "Submit",
        className: "login-form-button",
        buttonType: "primary",
        htmlType: "submit"
    },
    "cancel": {
        text: "Cancel",
        htmlType: "button",
    },
    "reset": {
        text: "Reset",
        danger: true,
        htmlType: "reset",
    }
}

interface ICreateButtons {
    formButtons: Array<IPreDefinedButtons | IFormButton>
    loader?: boolean
    routeParams?: Record<string, any>
    onCancelCallback?: () => void  // For modal cancel/close
    /** Text to show on submit button during throttle cooldown (e.g. "Wait 5s") */
    throttleText?: string;
    /** Whether the submit button should be disabled due to throttle cooldown */
    isThrottled?: boolean;
}

export const CreateButtons = React.memo(({ formButtons, loader = false, routeParams = {}, onCancelCallback, throttleText, isThrottled }: ICreateButtons) => {

    const renderButton = (
        buttonConfig: IFormButton = { text: "Unknown" },
        loader: boolean = false,
        isCancelButton: boolean = false,
        isDisabled: boolean = false,
        disabledMessage?: string
    ) => {
        const htmlType: IHtmlType = buttonConfig?.htmlType || "button";

        // Handle URL placeholder substitution
        let processedUrl = buttonConfig.url;
        if (processedUrl && Object.keys(routeParams).length > 0) {
            processedUrl = substituteUrlParams(processedUrl, routeParams);
        }

        /**
         * IMPORTANT:
         * If this is a submit/reset button, it must behave like a real form action.
         * Rendering a nested <a> (Link) inside the Button can intercept clicks and prevent the
         * AntD <Form onFinish> submit flow from firing, making "Submit" appear to do nothing.
         */
        const isFormActionButton = htmlType === "submit" || htmlType === "reset";
        if (isFormActionButton) {
            processedUrl = undefined;
        }

        // For cancel buttons in modal context, call onCancelCallback instead of navigating/resetting
        // CRITICAL: Do NOT render Link component for cancel buttons in modals
        const shouldUseCallback = isCancelButton && onCancelCallback;

        const handleClick = (e: React.MouseEvent<HTMLElement>) => {
            if (shouldUseCallback) {
                e.preventDefault();  // Prevent any navigation/reset
                e.stopPropagation(); // Stop event bubbling
                onCancelCallback();  // Close modal instead
            } else if (buttonConfig.onClick) {
                buttonConfig.onClick(e);
            }
        };

        // Apply throttle state to submit buttons
        // Check both htmlType and action — Form.tsx overrides htmlType to 'button' for React 19 compat
        const isSubmitBtn = htmlType === 'submit' || (buttonConfig).action === 'submit';
        const showThrottleText = isSubmitBtn && isThrottled && throttleText;
        const throttleDisabled = isSubmitBtn && isThrottled;

        return <Form.Item>
            <Button
                type={buttonConfig?.buttonType}
                size={buttonConfig.size ?? "middle"}
                href={buttonConfig.href}
                onClick={handleClick}
                htmlType={htmlType}
                className={buttonConfig?.className}
                danger={buttonConfig.danger}
                loading={loader && !throttleDisabled}
                disabled={isDisabled || throttleDisabled}
            >
                {showThrottleText
                    ? throttleText
                    : processedUrl && !shouldUseCallback
                        ? <Link title={buttonConfig.text} url={processedUrl} />
                        : buttonConfig.text}
            </Button>
        </Form.Item>
    }

    return <React.Fragment>
        {formButtons.map((buttonConfig, index: number) => {
            // Handle string shortcuts (e.g., "submit", "reset", "cancel")
            if (typeof buttonConfig === "string") {
                const isCancelButton = buttonConfig === "cancel";
                const config = PreDefinedButtons[ buttonConfig ];
                return <div key={"bt" + index} style={{ marginRight: "10px" }}>
                    <EvaluatedFormButton
                        buttonConfig={config}
                        loader={loader === true && buttonConfig !== "cancel" && buttonConfig !== "reset"}
                        isCancelButton={isCancelButton}
                        renderButton={renderButton}
                    />
                </div>
            } else {
                // Handle button objects
                // Check if button has 'action' field matching a predefined button
                const action = buttonConfig.action as IPreDefinedButtons | undefined;
                const isCancelButton = action === 'cancel' || buttonConfig.text?.toLowerCase().includes('cancel') || buttonConfig.className?.includes('cancel');

                // If action matches a predefined button, merge with predefined config
                const finalConfig = action && PreDefinedButtons[ action ]
                    ? { ...PreDefinedButtons[ action ], ...buttonConfig }  // Predefined defaults + custom overrides
                    : buttonConfig;  // Fully custom button

                return <div key={"bt" + index} style={{ marginRight: "10px" }}>
                    <EvaluatedFormButton
                        buttonConfig={finalConfig}
                        loader={action === 'submit' && loader}  // Only show loader on submit
                        isCancelButton={isCancelButton}
                        renderButton={renderButton}
                    />
                </div>
            }
        })}
    </React.Fragment>
});

/**
 * Form button with condition evaluation support.
 * Uses the new Condition system exclusively (useCondition) for both visibility and enablement.
 * 
 * Context is provided by useNewEvaluationContext (via useCondition internally),
 * which already includes stable formValues from FormStateContext.
 * No need for Form.useWatch or manual debouncing.
 */
const EvaluatedFormButton = React.memo(({
    buttonConfig,
    loader,
    isCancelButton,
    renderButton
}: {
    buttonConfig: IFormButton;
    loader: boolean;
    isCancelButton: boolean;
    renderButton: (config: IFormButton, loader: boolean, isCancelButton: boolean, isDisabled: boolean, disabledMessage?: string) => React.ReactNode;
}) => {
    // Evaluate visibility and enablement using new condition system
    // useCondition internally uses useNewEvaluationContext which includes
    // stable formValues, record, isDirty, isValid, etc.
    const isVisible = useCondition(buttonConfig.visibility);
    const isEnabled = useCondition(buttonConfig.enablement);
    const evaluationContext = useNewEvaluationContext();

    // Don't render if not visible
    if (!isVisible) return null;

    // Determine disabled state from enablement condition
    const isDisabled = buttonConfig.enablement !== undefined ? !isEnabled : false;

    // Resolve disabledMessage template (e.g., 'Fill in {formValues.name} first')
    const resolvedMessage = isDisabled
        ? resolveMsg(buttonConfig.disabledMessage, evaluationContext)
        : undefined;

    // Wrap with tooltip if disabled
    if (isDisabled && resolvedMessage) {
        return (
            <Tooltip title={resolvedMessage}>
                <span>
                    {renderButton(buttonConfig, loader, isCancelButton, true, resolvedMessage)}
                </span>
            </Tooltip>
        );
    }

    return <>{renderButton(buttonConfig, loader, isCancelButton, isDisabled)}</>;
});

export type { ICreateButtons };
