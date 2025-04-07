// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ storage.Interface = (*Storage)(nil)

// Storage implements storage.Interface and stores resources in unified storage
type Storage struct {
	config       *storagebackend.ConfigForResource
	store        resource.ResourceStoreClient
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	// trigger      storage.IndexerFuncs
	// indexers     *cache.Indexers
}

func NewStorage(
	config *storagebackend.ConfigForResource,
	gr schema.GroupResource,
	store resource.ResourceStoreClient,
	codec runtime.Codec,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
) (storage.Interface, factory.DestroyFunc, error) {
	return &Storage{
		config:       config,
		gr:           gr,
		codec:        codec,
		store:        store,
		keyFunc:      keyFunc,
		newFunc:      newFunc,
		newListFunc:  newListFunc,
		getAttrsFunc: getAttrsFunc,
	}, nil, nil
}

func errorWrap(status *resource.ErrorResult) error {
	if status != nil {
		err := &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    status.Code,
			Reason:  metav1.StatusReason(status.Reason),
			Message: status.Message,
		}}
		if status.Details != nil {
			err.ErrStatus.Details = &metav1.StatusDetails{
				Group:             status.Details.Group,
				Kind:              status.Details.Kind,
				Name:              status.Details.Name,
				UID:               types.UID(status.Details.Uid),
				RetryAfterSeconds: status.Details.RetryAfterSeconds,
			}
			for _, c := range status.Details.Causes {
				err.ErrStatus.Details.Causes = append(err.ErrStatus.Details.Causes, metav1.StatusCause{
					Type:    metav1.CauseType(c.Reason),
					Message: c.Message,
					Field:   c.Field,
				})
			}
		}
		return err
	}
	return nil
}

func getKey(val string) (*resource.ResourceKey, error) {
	k, err := grafanaregistry.ParseKey(val)
	if err != nil {
		return nil, err
	}
	// if k.Group == "" {
	// 	return nil, apierrors.NewInternalError(fmt.Errorf("missing group in request"))
	// }
	if k.Resource == "" {
		return nil, apierrors.NewInternalError(fmt.Errorf("missing resource in request"))
	}
	return &resource.ResourceKey{
		Namespace: k.Namespace,
		Group:     k.Group,
		Resource:  k.Resource,
		Name:      k.Name,
	}, err
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *Storage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	k, err := getKey(key)
	if err != nil {
		return err
	}

	value, err := s.prepareObjectForStorage(ctx, obj)
	if err != nil {
		return err
	}
	cmd := &resource.CreateRequest{
		Key:   k,
		Value: value,
	}

	rsp, err := s.store.Create(ctx, cmd)
	if err != nil {
		return err
	}
	err = errorWrap(rsp.Error)
	if err != nil {
		return err
	}

	if rsp.Error != nil {
		return fmt.Errorf("error in status %+v", rsp.Error)
	}

	// Decode into the result (can we just copy?)
	_, _, err = s.codec.Decode(cmd.Value, nil, out)
	if err != nil {
		return err
	}
	after, err := utils.MetaAccessor(out)
	if err != nil {
		return err
	}
	after.SetResourceVersionInt64(rsp.ResourceVersion)
	return nil
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) Delete(ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions, validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	k, err := getKey(key)
	if err != nil {
		return err
	}

	// if validateDeletion != nil {
	// 	return fmt.Errorf("not supported (validate deletion)")
	// }

	cmd := &resource.DeleteRequest{Key: k}
	if preconditions != nil {
		if preconditions.ResourceVersion != nil {
			cmd.ResourceVersion, err = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
			if err != nil {
				return err
			}
		}
		if preconditions.UID != nil {
			cmd.Uid = string(*preconditions.UID)
		}
	}

	rsp, err := s.store.Delete(ctx, cmd)
	if err != nil {
		return err
	}
	err = errorWrap(rsp.Error)
	if err != nil {
		return err
	}
	return nil
}

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by 'p' are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *Storage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	listopts, _, err := toListRequest(key, opts)
	if err != nil {
		return nil, err
	}
	if listopts == nil {
		return watch.NewEmptyWatch(), nil
	}

	cmd := &resource.WatchRequest{
		Since:               listopts.ResourceVersion,
		Options:             listopts.Options,
		SendInitialEvents:   false,
		AllowWatchBookmarks: opts.Predicate.AllowWatchBookmarks,
	}
	if opts.SendInitialEvents != nil {
		cmd.SendInitialEvents = *opts.SendInitialEvents
	}

	client, err := s.store.Watch(ctx, cmd)
	if err != nil {
		// if the context was canceled, just return a new empty watch
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, io.EOF) {
			return watch.NewEmptyWatch(), nil
		}
		return nil, err
	}

	reporter := apierrors.NewClientErrorReporter(500, "WATCH", "")
	decoder := &streamDecoder{
		client:  client,
		newFunc: s.newFunc,
		opts:    opts,
		codec:   s.codec,
	}

	return watch.NewStreamWatcher(decoder, reporter), nil
}

// Get decodes object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	var err error
	req := &resource.ReadRequest{}
	req.Key, err = getKey(key)
	if err != nil {
		return err
	}

	if opts.ResourceVersion != "" {
		req.ResourceVersion, err = strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return err
		}
	}

	rsp, err := s.store.Read(ctx, req)
	if err != nil {
		return err
	}
	err = errorWrap(rsp.Error)
	if err != nil {
		return err
	}

	_, _, err = s.codec.Decode(rsp.Value, &schema.GroupVersionKind{}, objPtr)
	if err != nil {
		return err
	}
	obj, err := utils.MetaAccessor(objPtr)
	if err != nil {
		return err
	}
	obj.SetResourceVersionInt64(rsp.ResourceVersion)
	return nil
}

func toListRequest(key string, opts storage.ListOptions) (*resource.ListRequest, storage.SelectionPredicate, error) {
	predicate := opts.Predicate
	k, err := getKey(key)
	if err != nil {
		return nil, predicate, err
	}
	req := &resource.ListRequest{
		Limit: opts.Predicate.Limit,
		Options: &resource.ListOptions{
			Key: k,
		},
		NextPageToken: predicate.Continue,
	}

	if opts.Predicate.Label != nil && !opts.Predicate.Label.Empty() {
		requirements, selectable := opts.Predicate.Label.Requirements()
		if !selectable {
			return nil, predicate, nil // not selectable
		}

		for _, r := range requirements {
			v := r.Key()

			req.Options.Labels = append(req.Options.Labels, &resource.Requirement{
				Key:      v,
				Operator: string(r.Operator()),
				Values:   r.Values().List(),
			})
		}
	}

	if opts.Predicate.Field != nil && !opts.Predicate.Field.Empty() {
		requirements := opts.Predicate.Field.Requirements()
		for _, r := range requirements {
			requirement := &resource.Requirement{Key: r.Field, Operator: string(r.Operator)}
			if r.Value != "" {
				requirement.Values = append(requirement.Values, r.Value)
			}
			req.Options.Labels = append(req.Options.Labels, requirement)
		}
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, predicate, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
		req.ResourceVersion = rv
	}

	switch opts.ResourceVersionMatch {
	case "", metav1.ResourceVersionMatchNotOlderThan:
		req.VersionMatch = resource.ResourceVersionMatch_NotOlderThan
	case metav1.ResourceVersionMatchExact:
		req.VersionMatch = resource.ResourceVersionMatch_Exact
	default:
		return nil, predicate, apierrors.NewBadRequest(
			fmt.Sprintf("unsupported version match: %v", opts.ResourceVersionMatch),
		)
	}

	return req, predicate, nil
}

// GetList unmarshalls objects found at key into a *List api object (an object
// that satisfies runtime.IsList definition).
// If 'opts.Recursive' is false, 'key' is used as an exact match. If `opts.Recursive'
// is true, 'key' is used as a prefix.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	req, predicate, err := toListRequest(key, opts)
	if err != nil {
		return err
	}

	rsp, err := s.store.List(ctx, req)
	if err != nil {
		return err
	}

	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	for _, item := range rsp.Items {
		tmp := s.newFunc()

		tmp, _, err = s.codec.Decode(item.Value, nil, tmp)
		if err != nil {
			return err
		}
		obj, err := utils.MetaAccessor(tmp)
		if err != nil {
			return err
		}
		obj.SetResourceVersionInt64(item.ResourceVersion)

		// apply any predicates not handled in storage
		matches, err := predicate.Matches(tmp)
		if err != nil {
			return apierrors.NewInternalError(err)
		}
		if !matches {
			continue
		}

		v.Set(reflect.Append(v, reflect.ValueOf(tmp).Elem()))
	}

	listAccessor, err := meta.ListAccessor(listObj)
	if err != nil {
		return err
	}
	if rsp.NextPageToken != "" {
		listAccessor.SetContinue(rsp.NextPageToken)
	}
	if rsp.RemainingItemCount > 0 {
		listAccessor.SetRemainingItemCount(&rsp.RemainingItemCount)
	}
	if rsp.ResourceVersion > 0 {
		listAccessor.SetResourceVersion(strconv.FormatInt(rsp.ResourceVersion, 10))
	}
	return nil
}

// GuaranteedUpdate keeps calling 'tryUpdate()' to update key 'key' (of type 'destination')
// retrying the update until success if there is index conflict.
// Note that object passed to tryUpdate may change across invocations of tryUpdate() if
// other writers are simultaneously updating it, so tryUpdate() needs to take into account
// the current contents of the object when deciding how the update object should look.
// If the key doesn't exist, it will return NotFound storage error if ignoreNotFound=false
// else `destination` will be set to the zero value of it's type.
// If the eventual successful invocation of `tryUpdate` returns an output with the same serialized
// contents as the input, it won't perform any update, but instead set `destination` to an object with those
// contents.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	k, err := getKey(key)
	if err != nil {
		return err
	}

	// Get the current version
	err = s.Get(ctx, key, storage.GetOptions{}, destination)
	if err != nil {
		if ignoreNotFound && apierrors.IsNotFound(err) {
			// destination is already set to zero value
			// we'll create the resource
		} else {
			return err
		}
	}

	accessor, err := utils.MetaAccessor(destination)
	if err != nil {
		return err
	}

	// Early optimistic locking failure
	previousVersion, _ := strconv.ParseInt(accessor.GetResourceVersion(), 10, 64)
	if preconditions != nil {
		if preconditions.ResourceVersion != nil {
			rv, err := strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
			if err != nil {
				return err
			}
			if rv != previousVersion {
				return fmt.Errorf("optimistic locking mismatch (previousVersion mismatch)")
			}
		}

		if preconditions.UID != nil {
			if accessor.GetUID() != *preconditions.UID {
				return fmt.Errorf("optimistic locking mismatch (UID mismatch)")
			}
		}
	}

	res := &storage.ResponseMeta{}
	updatedObj, _, err := tryUpdate(destination, *res)
	if err != nil {
		var statusErr *apierrors.StatusError
		if errors.As(err, &statusErr) {
			// For now, forbidden may come from a mutation handler
			if statusErr.ErrStatus.Reason == metav1.StatusReasonForbidden {
				return statusErr
			}
		}
		return apierrors.NewInternalError(
			fmt.Errorf("could not successfully update object. key=%s, err=%s", k.String(), err.Error()),
		)
	}

	value, err := s.prepareObjectForUpdate(ctx, updatedObj, destination)
	if err != nil {
		return err
	}

	req := &resource.UpdateRequest{Key: k, Value: value}
	rsp, err := s.store.Update(ctx, req)
	if err != nil {
		return err
	}
	err = errorWrap(rsp.Error)
	if err != nil {
		return err
	}

	// Decode into the response (can we just copy?)
	_, _, err = s.codec.Decode(value, nil, destination)
	if err != nil {
		return err
	}
	accessor, err = utils.MetaAccessor(destination)
	if err != nil {
		return err
	}
	accessor.SetResourceVersionInt64(rsp.ResourceVersion)
	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *Storage) Count(key string) (int64, error) {
	return 0, nil
}

func (s *Storage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

func (s *Storage) RequestWatchProgress(ctx context.Context) error {
	return nil
}
