import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import { createRef } from 'react';

import { FieldType, GrafanaTheme2, formattedValueToString, getFieldDisplayName } from '@grafana/data/src';
import { Portal, useStyles2, VizTooltipContainer } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';
import { CloseButton } from '@grafana/ui/src/components/uPlot/plugins/CloseButton';
import { Scene } from 'app/features/canvas/runtime/scene';

interface Props {
  scene: Scene;
}

export const CanvasTooltip = ({ scene }: Props) => {
  const styles = useStyles2(getStyles);

  const onClose = () => {
    if (scene?.tooltipCallback && scene.tooltip) {
      scene.tooltipCallback(undefined);
    }
  };

  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose: onClose, isDismissable: true }, ref);
  const { dialogProps } = useDialog({}, ref);

  const element = scene.tooltip?.element;
  if (!element) {
    return <></>;
  }

  // Retrieve timestamp of the last data point if available
  const timeField = scene.data?.series[0].fields?.find((field) => field.type === FieldType.time);
  const lastTimeValue = timeField?.values[timeField.values.length - 1];
  const shouldDisplayTimeContentItem =
    timeField && lastTimeValue && element.data.field && getFieldDisplayName(timeField) !== element.data.field;

  const headerItem: VizTooltipItem | null = {
    label: element.getName(),
    value: '',
  };

  const contentItems: VizTooltipItem[] = [
    {
      label: element.data.field ?? 'Fixed',
      value: element.data.text,
    },
    ...(shouldDisplayTimeContentItem
      ? [
          {
            label: 'Time',
            value: formattedValueToString(timeField?.display!(lastTimeValue)),
          },
        ]
      : []),
  ];

  return (
    <>
      {scene.tooltip?.element && scene.tooltip.anchorPoint && (
        <Portal>
          <VizTooltipContainer
            className={cx(styles.tooltipWrapper, scene.tooltip.isOpen && styles.pinned)}
            position={{ x: scene.tooltip.anchorPoint.x, y: scene.tooltip.anchorPoint.y }}
            offset={{ x: 5, y: 0 }}
            allowPointerEvents={scene.tooltip.isOpen}
          >
            <section ref={ref} {...overlayProps} {...dialogProps}>
              {scene.tooltip.isOpen && <CloseButton style={{ zIndex: 1 }} onClick={onClose} />}
              <VizTooltipHeader item={headerItem} isPinned={scene.tooltip.isOpen!} />
              {element.data.text && <VizTooltipContent items={contentItems} isPinned={scene.tooltip.isOpen!} />}
              <VizTooltipFooter dataLinks={element.data?.links} />
            </section>
          </VizTooltipContainer>
        </Portal>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: '20px',
    background: theme.colors.background.primary,
  }),
  tooltipWrapper: css({
    top: 0,
    left: 0,
    zIndex: theme.zIndex.portal,
    whiteSpace: 'pre',
    borderRadius: theme.shape.radius.default,
    position: 'fixed',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    userSelect: 'text',
    padding: 0,
  }),
  pinned: css({
    boxShadow: theme.shadows.z3,
  }),
});
