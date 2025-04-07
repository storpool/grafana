import { css, cx } from '@emotion/css';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import NativeScrollbar from 'app/core/components/NativeScrollbar';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getNavModel } from 'app/core/selectors/navModel';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';
import { useSelector } from 'app/types';

import { DashboardScene } from './DashboardScene';
import { NavToolbarActions } from './NavToolbarActions';

export function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { controls, overlay, editview, editPanel, isEmpty, meta } = model.useState();
  const headerHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, headerHeight);
  const location = useLocation();
  const navIndex = useSelector((state) => state.navIndex);
  const pageNav = model.getPageNav(location, navIndex);
  const bodyToRender = model.getBodyToRender();
  const navModel = getNavModel(navIndex, 'dashboards/browse');
  const hasControls = controls?.hasControls();

  if (editview) {
    return (
      <>
        <editview.Component model={editview} />
        {overlay && <overlay.Component model={overlay} />}
      </>
    );
  }

  const emptyState = (
    <DashboardEmpty dashboard={model} canCreate={!!model.state.meta.canEdit} key="dashboard-empty-state" />
  );

  const withPanels = (
    <div className={cx(styles.body, !hasControls && styles.bodyWithoutControls)} key="dashboard-panels">
      <bodyToRender.Component model={bodyToRender} />
    </div>
  );

  const notFound = meta.dashboardNotFound && <EntityNotFound entity="Dashboard" key="dashboard-not-found" />;

  let body = [withPanels];

  if (notFound) {
    body = [notFound];
  } else if (isEmpty) {
    body = [emptyState, withPanels];
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Custom}>
      {editPanel && <editPanel.Component model={editPanel} />}
      {!editPanel && (
        <NativeScrollbar divId="page-scrollbar" autoHeightMin={'100%'}>
          <div className={cx(styles.pageContainer, hasControls && styles.pageContainerWithControls)}>
            <NavToolbarActions dashboard={model} />
            {controls && (
              <div className={styles.controlsWrapper}>
                <controls.Component model={controls} />
              </div>
            )}
            <div className={cx(styles.canvasContent)}>{body}</div>
          </div>
        </NativeScrollbar>
      )}
      {overlay && <overlay.Component model={overlay} />}
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2, headerHeight: number | undefined) {
  return {
    pageContainer: css({
      display: 'grid',
      gridTemplateAreas: `
  "panels"`,
      gridTemplateColumns: `1fr`,
      gridTemplateRows: '1fr',
      flexGrow: 1,
      [theme.breakpoints.down('sm')]: {
        display: 'flex',
        flexDirection: 'column',
      },
    }),
    pageContainerWithControls: css({
      gridTemplateAreas: `
        "controls"
        "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      gridArea: 'controls',
      padding: theme.spacing(2),
      ':empty': {
        display: 'none',
      },
      // Make controls sticky on larger screens (> mobile)
      [theme.breakpoints.up('md')]: {
        position: 'sticky',
        zIndex: theme.zIndex.activePanel,
        background: theme.colors.background.canvas,
        top: headerHeight,
      },
    }),
    canvasContent: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 2),
      flexBasis: '100%',
      gridArea: 'panels',
      flexGrow: 1,
      minWidth: 0,
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
      paddingBottom: theme.spacing(2),
      boxSizing: 'border-box',
    }),
    bodyWithoutControls: css({
      paddingTop: theme.spacing(2),
    }),
  };
}
