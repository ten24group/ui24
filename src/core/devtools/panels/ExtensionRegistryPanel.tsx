import React, { useMemo, useState } from 'react';
import { Typography, Table, Tag, Collapse, Statistic, Input, Segmented, Empty } from 'antd';
import {
  AppstoreOutlined,
  ApiOutlined,
  BlockOutlined,
  ControlOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { ExtensionRegistry } from '../../registry';
import { fieldTypeRegistry } from '../../registry/FieldTypeRegistry';

const { Text } = Typography;

type CategoryFilter = 'all' | 'page' | 'widget' | 'field' | 'renderer';

export const ExtensionRegistryPanel: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [fieldTypeSearch, setFieldTypeSearch] = useState('');

  const diagnostics = useMemo(() => ExtensionRegistry.getDiagnostics(), []);
  const ftDiagnostics = useMemo(() => fieldTypeRegistry.getDiagnostics(), []);

  const componentData = useMemo(() => {
    const list = ExtensionRegistry.listComponents();
    return list.map(reg => ({
      key: reg.key,
      name: reg.key,
      category: reg.category,
      description: reg.description,
    }));
  }, []);

  const filteredComponents = useMemo(() => {
    if (categoryFilter === 'all') return componentData;
    return componentData.filter(c => c.category === categoryFilter);
  }, [componentData, categoryFilter]);

  const entityOverrides = useMemo(() => {
    return ExtensionRegistry.listEntityOverrides().map(o => ({
      key: `${o.entityName}:${o.pageType}`,
      entityName: o.entityName,
      pageType: o.pageType,
    }));
  }, []);

  const commands = useMemo(() => {
    return ExtensionRegistry.getCommands().map(cmd => ({
      key: cmd.id,
      id: cmd.id,
      label: cmd.label,
      group: cmd.group,
      shortcut: cmd.shortcut,
    }));
  }, []);

  const fieldTypeData = useMemo(() => {
    const entries: Array<{ key: string; type: string; mode: string }> = [];
    const allTypes = fieldTypeRegistry.listAll();
    for (const [fieldType, modes] of Object.entries(allTypes)) {
      for (const mode of Object.keys(modes)) {
        entries.push({ key: `${fieldType}-${mode}`, type: fieldType, mode });
      }
    }
    return entries;
  }, []);

  const filteredFieldTypes = useMemo(() => {
    if (!fieldTypeSearch) return fieldTypeData;
    const q = fieldTypeSearch.toLowerCase();
    return fieldTypeData.filter(ft => ft.type.toLowerCase().includes(q) || ft.mode.toLowerCase().includes(q));
  }, [fieldTypeData, fieldTypeSearch]);

  const componentColumns = [
    {
      title: 'Key',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag color={
        v === 'page' ? 'blue' : v === 'widget' ? 'green' : v === 'field' ? 'purple' : 'orange'
      }>{v}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v?: string) => v ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> : null,
    },
  ];

  const fieldTypeColumns = [
    {
      title: 'Field Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
      render: (v: string) => <Tag color={
        v === 'form' ? 'blue' : v === 'detail' ? 'purple' : v === 'table' ? 'green' : 'default'
      }>{v}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 12 }}>
      {/* Diagnostics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        background: 'var(--ant-color-bg-layout, #fafafa)',
        borderRadius: 8,
      }}>
        <Statistic title="Components" value={diagnostics.componentCount} valueStyle={{ fontSize: 20 }} prefix={<AppstoreOutlined style={{ fontSize: 14 }} />} />
        <Statistic title="Page Types" value={diagnostics.pageTypeCount} valueStyle={{ fontSize: 20 }} prefix={<LayoutOutlined style={{ fontSize: 14 }} />} />
        <Statistic title="Field Types" value={ftDiagnostics.builtInCount} valueStyle={{ fontSize: 20 }} prefix={<BlockOutlined style={{ fontSize: 14 }} />} />
        <Statistic title="Entity Overrides" value={diagnostics.entityPageCount} valueStyle={{ fontSize: 20 }} prefix={<ApiOutlined style={{ fontSize: 14 }} />} />
      </div>

      <Collapse
        defaultActiveKey={['components']}
        size="small"
        items={[
          {
            key: 'components',
            label: (
              <span>
                <AppstoreOutlined style={{ marginRight: 6 }} />
                Components
                <Tag style={{ marginLeft: 8 }}>{filteredComponents.length}</Tag>
              </span>
            ),
            children: (
              <>
                <Segmented
                  size="small"
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val as CategoryFilter)}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Page', value: 'page' },
                    { label: 'Widget', value: 'widget' },
                    { label: 'Field', value: 'field' },
                    { label: 'Renderer', value: 'renderer' },
                  ]}
                  style={{ marginBottom: 8 }}
                />
                <Table
                  dataSource={filteredComponents}
                  columns={componentColumns}
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'No components in this category' }}
                />
              </>
            ),
          },
          {
            key: 'overrides',
            label: (
              <span>
                <ApiOutlined style={{ marginRight: 6 }} />
                Entity Overrides
                <Tag style={{ marginLeft: 8 }}>{entityOverrides.length}</Tag>
              </span>
            ),
            children: entityOverrides.length > 0 ? (
              <Table
                dataSource={entityOverrides}
                columns={[
                  {
                    title: 'Entity',
                    dataIndex: 'entityName',
                    key: 'entityName',
                    render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
                  },
                  {
                    title: 'Page Type',
                    dataIndex: 'pageType',
                    key: 'pageType',
                    render: (v: string) => <Tag color="blue">{v}</Tag>,
                  },
                ]}
                size="small"
                pagination={false}
              />
            ) : <Empty description="No entity overrides" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'commands',
            label: (
              <span>
                <ThunderboltOutlined style={{ marginRight: 6 }} />
                Commands
                <Tag style={{ marginLeft: 8 }}>{commands.length}</Tag>
              </span>
            ),
            children: commands.length > 0 ? (
              <Table
                dataSource={commands}
                columns={[
                  {
                    title: 'ID',
                    dataIndex: 'id',
                    key: 'id',
                    render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
                  },
                  { title: 'Label', dataIndex: 'label', key: 'label' },
                  {
                    title: 'Group',
                    dataIndex: 'group',
                    key: 'group',
                    render: (v?: string) => v ? <Tag>{v}</Tag> : null,
                  },
                  {
                    title: 'Shortcut',
                    dataIndex: 'shortcut',
                    key: 'shortcut',
                    render: (v?: string) => v ? <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>{v}</Tag> : null,
                  },
                ]}
                size="small"
                pagination={false}
              />
            ) : <Empty description="No commands registered" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'fieldTypes',
            label: (
              <span>
                <ControlOutlined style={{ marginRight: 6 }} />
                Field Type Renderers
                <Tag style={{ marginLeft: 8 }}>{fieldTypeData.length}</Tag>
              </span>
            ),
            children: (
              <>
                <Input
                  prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.25))' }} />}
                  placeholder="Filter field types..."
                  size="small"
                  allowClear
                  value={fieldTypeSearch}
                  onChange={e => setFieldTypeSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <Table
                  dataSource={filteredFieldTypes}
                  columns={fieldTypeColumns}
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'No field type renderers' }}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
};
