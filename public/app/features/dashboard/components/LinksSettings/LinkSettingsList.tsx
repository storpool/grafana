import { css } from '@emotion/css';
import React, { useState } from 'react';

import { arrayUtils } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';
import { DeleteButton, HorizontalGroup, Icon, IconButton, TagList, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

import { DashboardModel } from '../../state/DashboardModel';
import { ListNewButton } from '../DashboardSettings/ListNewButton';

type LinkSettingsListProps = {
  dashboard: DashboardModel;
  onNew: () => void;
  onEdit: (idx: number) => void;
};

export const LinkSettingsList = ({ dashboard, onNew, onEdit }: LinkSettingsListProps) => {
  const styles = useStyles2(getStyles);

  const [links, setLinks] = useState(dashboard.links);

  const moveLink = (idx: number, direction: number) => {
    dashboard.links = arrayUtils.moveItemImmutably(links, idx, idx + direction);
    setLinks(dashboard.links);
  };

  const duplicateLink = (link: DashboardLink, idx: number) => {
    dashboard.links = [...links, { ...link }];
    setLinks(dashboard.links);
  };

  const deleteLink = (idx: number) => {
    dashboard.links = [...links.slice(0, idx), ...links.slice(idx + 1)];
    setLinks(dashboard.links);
  };

  const isEmptyList = dashboard.links.length === 0;

  if (isEmptyList) {
    return (
      <div>
        <EmptyListCTA
          onClick={onNew}
          title="There are no dashboard links added yet"
          buttonIcon="link"
          buttonTitle="Add dashboard link"
          infoBoxTitle="What are dashboard links?"
          infoBox={{
            __html:
              '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
          }}
        />
      </div>
    );
  }

  return (
    <>
      <table role="grid" className="filter-table filter-table--hover">
        <thead>
          <tr>
            <th>Type</th>
            <th>Info</th>
            <th colSpan={3} />
          </tr>
        </thead>
        <tbody>
          {links.map((link, idx) => (
            <tr key={`${link.title}-${idx}`}>
              <td role="gridcell" className="pointer" onClick={() => onEdit(idx)}>
                <Icon name="external-link-alt" /> &nbsp; {link.type}
              </td>
              <td role="gridcell">
                <HorizontalGroup>
                  {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
                  {link.type === 'link' && <span className={styles.urlWrapper}>{link.url}</span>}
                  {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
                </HorizontalGroup>
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                {idx !== 0 && <IconButton name="arrow-up" onClick={() => moveLink(idx, -1)} tooltip="Move link up" />}
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                {links.length > 1 && idx !== links.length - 1 ? (
                  <IconButton name="arrow-down" onClick={() => moveLink(idx, 1)} tooltip="Move link down" />
                ) : null}
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                <IconButton name="copy" onClick={() => duplicateLink(link, idx)} tooltip="Copy link" />
              </td>
              <td style={{ width: '1%' }} role="gridcell">
                <DeleteButton
                  aria-label={`Delete link with title "${link.title}"`}
                  size="sm"
                  onConfirm={() => deleteLink(idx)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ListNewButton onClick={onNew}>New link</ListNewButton>
    </>
  );
};

const getStyles = () => ({
  titleWrapper: css`
    width: 20vw;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
  urlWrapper: css`
    width: 40vw;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
});
