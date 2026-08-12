/// <reference types="@testing-library/jest-dom" />
/**
 * Option thumbnails for select / multi-select / radio fields.
 *
 * Some choices are recognised visually — a team by its crest — and a URL printed
 * in the label text is not a usable substitute. These tests pin the two things
 * that make the feature safe: the image is added without disturbing the label's
 * role as the option's text identity (search, a11y), and fields whose options
 * carry no image keep antd's default rendering.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../../modal/Modal', () => ({
  OpenInModal: ({ children }: any) => <>{children}</>,
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
}));

jest.mock('../../../hooks', () => ({
  useEntityConfig: () => ({ resolveConfigRef: () => undefined }),
}));

jest.mock('../../../context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: { items: [] } }) }),
}));

import { OptionSelector } from '../OptionSelector';

const TEAMS = [
  { label: 'Barcelona · Spain · id 529', value: '529', image: 'https://logos/529.png' },
  { label: 'Barcelona SC · Ecuador · id 9001', value: '9001', image: 'https://logos/9001.png' },
];

function renderSelector(props: Record<string, any>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OptionSelector fieldType="select" onOptionChange={jest.fn()} {...(props as any)} />
    </QueryClientProvider>
  );
}

const logos = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img')).map(img => img.getAttribute('src'));

describe('option thumbnails', () => {
  it('renders each option image in the radio list', () => {
    const { container } = renderSelector({ fieldType: 'radio', options: TEAMS });

    expect(logos(container)).toEqual([ 'https://logos/529.png', 'https://logos/9001.png' ]);
  });

  it('keeps the label text alongside the image, so the option stays searchable and readable', () => {
    renderSelector({ fieldType: 'radio', options: TEAMS });

    expect(screen.getByText('Barcelona · Spain · id 529')).toBeInTheDocument();
    expect(screen.getByText('Barcelona SC · Ecuador · id 9001')).toBeInTheDocument();
  });

  it('marks images as decorative so they are not announced twice', () => {
    const { container } = renderSelector({ fieldType: 'radio', options: TEAMS });

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders images in the select dropdown', async () => {
    const { container } = renderSelector({ fieldType: 'select', options: TEAMS });

    fireEvent.mouseDown(container.querySelector('.ant-select-selector')!);

    // antd renders the dropdown into a portal on document.body, not in `container`.
    await waitFor(() => expect(logos(document.body).length).toBeGreaterThan(0));
    expect(logos(document.body)).toContain('https://logos/529.png');
    expect(logos(document.body)).toContain('https://logos/9001.png');
  });

  it('shows the chosen option with its image', () => {
    const { container } = renderSelector({ fieldType: 'select', options: TEAMS, value: '529' });

    expect(logos(container)).toContain('https://logos/529.png');
  });

  it('reserves the thumbnail slot for an option with no image, so rows stay aligned', () => {
    const { container } = renderSelector({
      fieldType: 'radio',
      options: [ TEAMS[ 0 ], { label: 'No crest · id 7', value: '7' } ],
    });

    // One <img> for the option that has one; the other renders a same-size spacer.
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByText('No crest · id 7')).toBeInTheDocument();
  });

  it('renders no images at all when no option has one', () => {
    const { container } = renderSelector({
      fieldType: 'radio',
      options: [ { label: 'Football', value: 'football' }, { label: 'Hockey', value: 'hockey' } ],
    });

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0);
    expect(screen.getByText('Football')).toBeInTheDocument();
  });

  it('renders images for multi-select too', () => {
    const { container } = renderSelector({ fieldType: 'multi-select', options: TEAMS, value: [ '529' ] });

    expect(logos(container)).toContain('https://logos/529.png');
  });
});
