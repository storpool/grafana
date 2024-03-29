import React, { PureComponent } from 'react';

import { Field, FieldSet, InlineFormLabel, TextArea } from '@grafana/ui';

import InfluxDatasource from '../../../datasource';
import { InfluxVersion } from '../../../types';
import { FluxQueryEditor } from '../query/flux/FluxQueryEditor';

interface Props {
  query: string; // before flux, it was always a string
  onChange: (query?: string) => void;
  datasource: InfluxDatasource;
}

export default class VariableQueryEditor extends PureComponent<Props> {
  onRefresh = () => {
    // noop
  };

  render() {
    let { query, datasource, onChange } = this.props;

    switch (datasource.version) {
      case InfluxVersion.Flux:
        return (
          <FluxQueryEditor
            datasource={datasource}
            query={{
              refId: 'A',
              query,
            }}
            onRunQuery={this.onRefresh}
            onChange={(v) => onChange(v.query)}
          />
        );
      case InfluxVersion.SQL:
        return (
          <FieldSet>
            <Field htmlFor="influx-sql-variable-query">
              <TextArea
                id="influx-sql-variable-query"
                defaultValue={query || ''}
                placeholder="metric name or tags query"
                rows={1}
                onBlur={(e) => onChange(e.currentTarget.value)}
              />
            </Field>
          </FieldSet>
        );
      case InfluxVersion.InfluxQL:
      default:
        return (
          <div className="gf-form-inline">
            <InlineFormLabel width={10}>Query</InlineFormLabel>
            <div className="gf-form-inline gf-form--grow">
              <TextArea
                defaultValue={query || ''}
                placeholder="metric name or tags query"
                rows={1}
                className="gf-form-input"
                onBlur={(e) => onChange(e.currentTarget.value)}
              />
            </div>
          </div>
        );
    }
  }
}
