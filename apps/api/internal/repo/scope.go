package repo

import (
	"fmt"
	"strings"

	"github.com/developerluch/phantomcrm/apps/api/internal/filters"
)

// BuildWhere produces the complete WHERE fragment, bound args (in $1..$N
// order), and any subtype-view JOINs required to satisfy
//
//   - the caller's filter,
//   - the entity's soft-delete convention (default: exclude archived),
//   - row-level visibility (admin short-circuits; non-admins see rows they
//     own or that are shared with their discord ID).
//
// This is the ONLY place visibility is enforced. Callers never hand-write
// scope SQL; they pass their ActorScope into BuildWhere and trust the result.
//
// includeArchived defaults false; /restore-style code paths pass true.
func BuildWhere(
	e Entity,
	filter filters.FilterNode,
	scope ActorScope,
	includeArchived bool,
) (where string, args []any, joins []string, err error) {
	reg := e.FieldRegistry()
	ctx := filters.NewCompileCtx(e.TableName(), reg)

	var parts []string

	if filter != nil {
		if err := filter.Validate(reg); err != nil {
			return "", nil, nil, err
		}
		sql, err := filter.Compile(ctx)
		if err != nil {
			return "", nil, nil, err
		}
		if sql != "" {
			parts = append(parts, sql)
		}
	}

	if sdCol, sdVal := e.SoftDeleteColumn(); sdCol != "" && !includeArchived {
		parts = append(parts, fmt.Sprintf("%s.%s <> %s",
			e.TableName(), sdCol, ctx.NextArg(sdVal)))
	}

	if !scope.IsAdmin {
		if ownerCol := e.OwnerColumn(); ownerCol != "" {
			actor := ctx.NextArg(scope.ActorDiscordID)
			clauses := []string{
				fmt.Sprintf("%s.%s = %s", e.TableName(), ownerCol, actor),
			}
			if shared := e.SharedColumn(); shared != "" {
				clauses = append(clauses,
					fmt.Sprintf("%s = ANY(%s.%s)", actor, e.TableName(), shared))
			}
			parts = append(parts, "("+strings.Join(clauses, " OR ")+")")
		}
	}

	if len(parts) > 0 {
		where = "WHERE " + strings.Join(parts, " AND ")
	}
	return where, ctx.Args(), ctx.Joins(), nil
}
