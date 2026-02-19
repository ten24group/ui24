import React, { useState, useMemo, useCallback } from 'react';
import { Steps, Button, Space, Typography } from 'antd';
import { LeftOutlined, RightOutlined, CheckOutlined } from '@ant-design/icons';
import type { IChainConfig, IChainStep } from './Modal';
import { conditionEvaluator } from '../core/utils/ConditionEvaluator';
import type { NewEvaluationContext } from '../core/types/evaluation';
import { useNewEvaluationContext } from '../core/context/NewEvaluationContext';
import type { IForm } from '../core/forms/formConfig';
import type { IDetailsConfig } from '../core/types/field-config';
import type { ITableConfig } from '../table/type';
import { Form } from '../forms/Form';
import { Details } from '../detail/Details';
import { Table } from '../table/Table';
import { ExtensionRegistry } from '../core/registry';

const { Text } = Typography;

interface ChainModalContentProps {
  chainConfig: IChainConfig;
  routeParams?: Record<string, unknown>;
  onComplete?: (values?: Record<string, unknown>) => void;
  onCancel?: () => void;
}

/**
 * Multi-step chain modal content renderer (#67).
 * Manages step navigation, conditional step resolution, and progress display.
 */
export const ChainModalContent: React.FC<ChainModalContentProps> = ({
  chainConfig,
  routeParams = {},
  onComplete,
  onCancel,
}) => {
  const { steps, showProgressBar } = chainConfig;
  const [currentStepId, setCurrentStepId] = useState(steps[0]?.id ?? '');
  const [stepHistory, setStepHistory] = useState<string[]>([]);
  const [accumulatedValues, setAccumulatedValues] = useState<Record<string, unknown>>({});
  const evalCtx = useNewEvaluationContext();

  const currentStep = useMemo(
    () => steps.find(s => s.id === currentStepId),
    [steps, currentStepId]
  );

  const currentStepIndex = useMemo(
    () => steps.findIndex(s => s.id === currentStepId),
    [steps, currentStepId]
  );

  const resolveNextStep = useCallback((step: IChainStep): string | undefined => {
    if (step.conditionalNextStep) {
      const ctx: NewEvaluationContext = {
        ...evalCtx,
        record: accumulatedValues,
        formValues: accumulatedValues,
      };
      for (const branch of step.conditionalNextStep) {
        const result = conditionEvaluator.evaluateSync(branch.when, ctx);
        if (result) return branch.step;
      }
    }
    return step.nextStep;
  }, [evalCtx, accumulatedValues]);

  const goToNext = useCallback((stepValues?: Record<string, unknown>) => {
    if (!currentStep) return;

    const merged = stepValues
      ? { ...accumulatedValues, ...stepValues }
      : accumulatedValues;
    setAccumulatedValues(merged);

    const nextId = resolveNextStep(currentStep);
    if (nextId) {
      setStepHistory(prev => [...prev, currentStepId]);
      setCurrentStepId(nextId);
    } else {
      onComplete?.(merged);
    }
  }, [currentStep, currentStepId, accumulatedValues, resolveNextStep, onComplete]);

  const goBack = useCallback(() => {
    if (stepHistory.length > 0) {
      const prev = stepHistory[stepHistory.length - 1];
      setStepHistory(h => h.slice(0, -1));
      setCurrentStepId(prev);
    }
  }, [stepHistory]);

  if (!currentStep) return null;

  const isFirstStep = stepHistory.length === 0;
  const hasNextStep = !!resolveNextStep(currentStep);

  const mergedRouteParams = { ...routeParams, ...accumulatedValues };

  const renderStepContent = () => {
    const stepType = currentStep.type;

    if (stepType === 'form' && currentStep.pageConfig) {
      const formConfig = currentStep.pageConfig as IForm;
      return (
        <Form
          {...formConfig}
          dataSource={formConfig.dataSource ?? (Object.keys(accumulatedValues).length > 0 ? accumulatedValues : undefined)}
          routeParams={mergedRouteParams as Record<string, string>}
          onSubmit={(values: Record<string, unknown>) => goToNext(values)}
          onSubmitSuccessCallback={(response?: Record<string, unknown>) => {
            if (response) goToNext(response);
            else goToNext();
          }}
          onCancelCallback={isFirstStep ? onCancel : goBack}
        />
      );
    }

    if (stepType === 'details' && currentStep.pageConfig) {
      const detailsConfig = currentStep.pageConfig as IDetailsConfig;
      return (
        <Details
          propertiesConfig={detailsConfig.propertiesConfig}
          columnsConfig={detailsConfig.columnsConfig}
          entityName={detailsConfig.entityName}
          detailApiConfig={detailsConfig.detailApiConfig}
          routeParams={mergedRouteParams as Record<string, string>}
          dataSource={accumulatedValues}
        />
      );
    }

    if (stepType === 'list' && currentStep.pageConfig) {
      const tableConfig = currentStep.pageConfig as ITableConfig;
      return (
        <Table
          {...tableConfig}
          routeParams={mergedRouteParams as Record<string, string>}
          dataSource={(accumulatedValues[tableConfig.entityName ?? 'records'] as Array<Record<string, unknown>>) ?? []}
        />
      );
    }

    if (stepType === 'confirm' || stepType === 'info') {
      const infoConfig = currentStep.pageConfig as { title?: string; content?: string } | undefined;
      return (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          {infoConfig?.title && <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 16 }}>{infoConfig.title}</Text>}
          {infoConfig?.content && <Text>{infoConfig.content}</Text>}
        </div>
      );
    }

    if (stepType === 'custom') {
      const customConfig = currentStep.pageConfig as { componentKey?: string } | undefined;
      if (customConfig?.componentKey) {
        const CustomComp = ExtensionRegistry.get<{
          values: Record<string, unknown>;
          routeParams: Record<string, unknown>;
          onNext: (stepValues?: Record<string, unknown>) => void;
          onBack: () => void;
        }>(customConfig.componentKey);
        if (CustomComp) {
          return <CustomComp values={accumulatedValues} routeParams={mergedRouteParams} onNext={goToNext} onBack={goBack} />;
        }
      }
      return <Text type="secondary">Custom component not found: {customConfig?.componentKey ?? 'none'}</Text>;
    }

    return <Text type="secondary">Unsupported step type: {String(stepType)}</Text>;
  };

  return (
    <div>
      {showProgressBar && (
        <Steps
          current={currentStepIndex}
          size="small"
          style={{ marginBottom: 24 }}
          items={steps.map(s => ({ title: s.title }))}
        />
      )}

      <div style={{ minHeight: 200 }}>
        {renderStepContent()}
      </div>

      {(currentStep.type === 'confirm' || currentStep.type === 'info' || currentStep.type === 'custom') && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={isFirstStep ? onCancel : goBack} icon={<LeftOutlined />}>
              {isFirstStep ? 'Cancel' : 'Back'}
            </Button>
            <Button type="primary" onClick={() => goToNext()} icon={hasNextStep ? <RightOutlined /> : <CheckOutlined />}>
              {hasNextStep ? 'Next' : 'Finish'}
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};
